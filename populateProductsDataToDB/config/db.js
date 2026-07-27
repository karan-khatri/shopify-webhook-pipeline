import { AppDataSource } from './pool.js';
// import mongoose from 'mongoose';

class DbConnection {
  static #connection;

  static async getConnection() {
    try {
      if (this.#connection) {
        console.log('DATABASE CONNECTED');
        return this.#connection;
      } else {
        console.log('TRYING TO CREATE CONNECTION WITH DATABASE');
        this.#connection = await AppDataSource.initialize();
        return this.#connection;
      }
    } catch (error) {
      throw error;
    }
  }
}

export default DbConnection;
