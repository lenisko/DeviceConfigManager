"use strict"

const query = require('../db.js');

class Log {
    constructor(uuid, timestamp, message) {
        this.uuid = uuid;
        this.timestamp = timestamp;
        this.message = message;
    }
    static async getAll() {
        var logs = await query("SELECT uuid, timestamp, message FROM logs");
        return logs;
    }
    static async create(uuid, message) {
        var sql = `
        INSERT INTO logs (uuid, timestamp, message)
        VALUES (?, UNIX_TIMESTAMP(), ?)`;
        var args = [uuid, message];
        var result = await query(sql, args);
        return result.affectedRows === 1;
    }
    static async delete(id) {
        var sql = "DELETE FROM logs WHERE id = ?";
        var args = [id];
        var result = await query(sql, args);
        return result.affectedRows === 1;
    }
    static async deleteAll(uuid) {
        var sql = "TRUNCATE TABLE logs";
        var result = await query(sql, []);
        return result.affectedRows > 0;
    }
}

module.exports = Log;