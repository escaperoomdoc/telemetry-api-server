import {env, exit} from 'process';
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

export function now(): string {
	let dt: Date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
	return dt.toISOString();
}

import redis, { RedisClient } from "redis";
const redisClient = redis.createClient({host: process.env.REDIS_URL, port: parseInt(process.env.REDIS_PORT as string)});
const redisSelect = promisify(redisClient.select).bind(redisClient);
const redisFlushall = promisify(redisClient.flushall).bind(redisClient);
const redisFlushdb = promisify(redisClient.flushdb).bind(redisClient);
const redisPing = promisify(redisClient.ping).bind(redisClient);
const redisKeys = promisify(redisClient.keys).bind(redisClient);
const redisGet = promisify(redisClient.get).bind(redisClient);
const redisSet = promisify(redisClient.set).bind(redisClient);
const redisDel = promisify(redisClient.del).bind(redisClient);
const redisExpire = promisify(redisClient.expire).bind(redisClient);

export class ApiServer {
	redisUpdating: boolean;
	app: Application;
	http: http.Server;
	result: any;
	constructor(cfg?: any) {
		this.redisUpdating = false;
		this.result = null;
		this.app = express();
		this.http = http.createServer(this.app);
	}
	public async start() {
		try {
			this.app.use(express.json());
			this.app.use(cors());
			//this.app.use(express.static('public'));
			this.setApiHandlers();
			this.http.listen(env.HTTP_PORT, () => {
				console.log(`telemetry-api-server started on ${env.HTTP_PORT}...`);
			});
			this.http.on('error', (e: any) => {
				if (e.code === 'EADDRINUSE') {
					console.log(`cannot start telemetry-api-server on ${env.HTTP_PORT}...`);
					process.exit(1);
				}
			})
		}
		catch(error) {
			console.log(`ApiServer.constructor() error: ${error}`);
			process.exit(1);
		}
	}
	public async redisUpdate() {
		try {
			console.log(`${now()}: updating redis...`);
			this.redisUpdating = true;
			let result: any = [];
			await redisSelect(1);
			let keys = await redisKeys('*');
			for (let key of keys) {
				let value = await redisGet(key)
				result.push(JSON.parse(value as string))
				console.log(`${now()}: value[${key}]=${value}`);
				await sleep(50)
			}
			this.result = result;
		}
		catch(error) {
			console.log(`ApiServer.redisUpdate() error: ${error}`);
		}
		this.redisUpdating = false;
		setTimeout(async() => {
			await this.redisUpdate();
		}, 5000)
	}
	private setApiHandlers() {
		this.app.get('/api/*', (req: Request, res: Response, next: NextFunction) => {
			if (!this.result) return res.status(400).json({
				error: 'data not ready'
			});
			return next();
		});
		this.app.get('/api/v1/get_gis_data', (req: Request, res: Response, next: NextFunction) => {
			return res.status(200).send({
				method: '/api/v1/get_gis_data',
				payload: this.result
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

let api = new ApiServer();
api.start();
api.redisUpdate();
