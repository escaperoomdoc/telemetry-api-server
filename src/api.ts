import express, {Application, Request, Response, NextFunction} from 'express';
import {FieldModelConverter} from './field-model-converter';
import {PrtReader} from './prt-reader';
import cors from 'cors';
import http from 'http';
import md5 from 'md5';

export class Api {
	ready: boolean;
	prt: PrtReader;
	app: Application;
	http: http.Server;
	cfg: any;
	map: any;
	constructor(cfg?: any) {
		this.ready = false;
		if (cfg) this.cfg = cfg;
		else this.cfg = {
			httpPort: 88,
			prtFilename: '2018.01.22-00.00.00.sps'
		}
		this.map = {
			model: null,
			modelHash: null,
			modelTime: 0,
			field: Array<any>(86400),
			engines: Array<any>(86400)
		}
		this.prt = new PrtReader();
		this.app = express();
		this.http = http.createServer(this.app);
		this.app.use(express.json());
		this.app.use(cors());
		this.app.use(express.static('tests/public'));
		this.setApiHandlers();
		this.http.listen(this.cfg.httpPort, () => {
			console.log(`field-model-converter started on ${this.cfg.httpPort}...`);
		});
		this.http.on('error', (e: any) => {
			if (e.code === 'EADDRINUSE') {
				console.log(`cannot start field-model-converter on ${this.cfg.httpPort}...`);
				process.exit(1);
			}
		})
	}
	public async start() {
		try {
			await this.prt.processFile(this.cfg.prtFilename, (time: number, type: string, data: Buffer) => {
				if (type === 'plan') {
					if (this.map.model) {
						console.log(`cannot handle several plans per file yet`);
						process.exit(1);
						return;
					}
					this.map.model = data.toString();
					let length = this.map.model.length;
					this.map.modelHash = md5(this.map.model);
				}
				if (type === 'field') {
					let str = data.toString();
					let length = str.length;
					if (!this.map.modelTime) {
						let dt = new Date(time);
						let year = dt.getFullYear();
						let month = dt.getMonth();
						let day = dt.getDate();
						let dtinit = new Date(year, month, day, 0, 0, 0);
						this.map.modelTime = dtinit.getTime();
					}
					let index = Math.floor((time - this.map.modelTime)/1000);
					if (index >= 0 && index < 86400) {
						this.map.field[index] = str;
					}
					length = length;
				}
				if ( type === 'engine' ) {
					if( this.map.modelTime ) {
						let index = Math.floor((time - this.map.modelTime)/1000);
						if (index >= 0 && index < 86400) {
							if( Array.isArray( this.map.engines[index] ))
								this.map.engines[index].push(data);
							else
								this.map.engines[index] = [ data ];
						}										
					}
				}
			});
			this.ready = true;
		}
   	catch(error) {
			console.log(`Api.start() error: ${error}`);
		}
	}
	private setApiHandlers() {
		this.app.get('/api/*', (req: Request, res: Response, next: NextFunction) => {
			if (!this.ready) return res.status(400).json({
				error: 'data not ready'
			});
			return next();
		});
		this.app.get('/api/model', (req: Request, res: Response, next: NextFunction) => {
			return res.status(200).send(this.map.model);
		});
		this.app.get('/api/field', (req: Request, res: Response, next: NextFunction) => {
			try {
				let index = -1;
				if (req.query && req.query.time) {
					index = parseInt(req.query.time as string, 10);
					if (!this.map.field[index]) throw 'no data found';
				}
				else throw 'time not specified';
				return res.status(200).json({
					modelHash: this.map.modelHash,
					modelField: this.map.field[index],
					modelEngines: this.map.engines[index]
				});
			}
			catch(error) {
				return res.status(400).json({
					error: error
				});
			}
		});
		this.app.get('/api/version', (req: Request, res: Response, next: NextFunction) => {
			return res.status(200).json({
				name: 'field-model-converter',
				buildVersion: '1',
				buildDatetime: '2021-09-24 15-42-07'
			});
		});		
	}
}


