import {exit} from 'process';
import {promisify} from "util";
import dotenv from 'dotenv';
import * as fs from "fs";
dotenv.config();

export const sleep = promisify(setTimeout);
export const fsread = promisify(fs.readFile);
export const fswrite = promisify(fs.writeFile);

import express, {Application, Request, Response, NextFunction} from 'express';
import cors from 'cors';
import http from 'http';
import md5 from 'md5';

export class ApiServer {
	ready: boolean;
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
		this.app.get('/api/v1/get_gis_data', (req: Request, res: Response, next: NextFunction) => {
			return res.status(200).send({
				method: '/api/v1/get_gis_data',
				payload: true
			});
		});
		this.app.get('/api/version', (req: Request, res: Response, next: NextFunction) => {
			return res.status(200).json({
				method: '/api/version',
				payload: {
					name: 'telemetry-api-server',
					version: '1'
				}
			});
		});		
	}
}

let api = new ApiServer(config);
api.start();
