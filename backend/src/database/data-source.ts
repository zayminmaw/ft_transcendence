import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { validateEnvironment } from '../common/config/environment';
import { databaseOptions } from './database.config';

export default new DataSource(databaseOptions(validateEnvironment(process.env)));
