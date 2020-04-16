"use strict"

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const mustacheExpress = require('mustache-express');
const config = require('./config.json');
const query = require('./db.js');

// TODO: Create routes class
// TODO: Create Config and Device model classes
// TODO: Error checking/handling
// TODO: Sql cascading
// TODO: Cleanup mysql connections after use

// Middleware
app.set('view engine', 'mustache');
app.set('views', './views');
app.engine("mustache", mustacheExpress());
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' })); // for parsing application/x-www-form-urlencoded


// UI Routes
app.get(['/', '/index'], function(req, res) {
    res.render('index', { title: config.title });
});

app.get('/devices', function(req, res) {
    res.render('devices', { title: config.title });
});

app.get('/device/new', async function(req, res) {
    res.render('device-new', { title: config.title });
});

app.get('/configs', function(req, res) {
    res.render('configs', { title: config.title });
});

app.get('/config/assign/:uuid', async function(req, res) {
	var sql = "SELECT name FROM config";
	var configs = await query(sql, []);
    var data = {
        title: config.title,
        configs: configs,
        device: req.params.uuid
    };
    res.render('config-assign', data);
});

app.get('/config/new', function(req, res) {
    res.render('config-new', { title: config.title });
});

app.get('/config/edit/:name', async function(req, res) {
	var name = req.params.name;
	var sql = "SELECT backend_url, port, heartbeat_max_time, pokemon_max_time, raid_max_time, startup_lat, startup_lon, token, jitter_value, max_warning_time_raid, encounter_delay, min_delay_logout, max_empty_gmo, max_failed_count, max_no_quests_count, logging_url, logging_port, logging_tls, logging_tcp, account_manager, deploy_eggs, nearby_tracker, auto_login, ultra_iv, ultra_quests FROM config WHERE name=? LIMIT 1";
	var args = [name];
	var cfg = await query(sql, args);
	// TODO: Error checking
	var c = cfg[0];
	c.name = name;
	var data = {
		title: config.title,
		old_name: name,
		name: name,
		backend_url: c.backend_url,
		port: c.port,
		heartbeat_max_time: c.heartbeat_max_time,
		pokemon_max_time: c.pokemon_max_time,
		raid_max_time: c.raid_max_time,
		startup_lat: c.startup_lat,
		startup_lon: c.startup_lon,
		token: c.token,
		jitter_value: c.jitter_value,
		max_warning_time_raid: c.max_warning_time_raid,
		encounter_delay: c.encounter_delay,
		min_delay_logout: c.min_delay_logout,
		max_empty_gmo: c.max_empty_gmo,
		max_failed_count: c.max_failed_count,
		max_no_quests_count: c.max_no_quests_count,
		logging_url: c.logging_url,
		logging_port: c.logging_port,
		logging_tls: c.logging_tls == 1 ? "checked" : "",
		logging_tcp: c.logging_tcp == 1 ? "checked" : "",
		account_manager: c.account_manager == 1 ? "checked" : "",
		deploy_eggs: c.deploy_eggs == 1 ? "checked" : "",
		nearby_tracker: c.nearby_tracker == 1 ? "checked" : "",
		auto_login: c.auto_login == 1 ? "checked" : "",
		ultra_iv: c.ultra_iv == 1 ? "checked" : "",
		ultra_quests: c.ultra_quests == 1 ? "checked" : ""
	};
	res.render('config-edit', data);
});

app.get('/config/delete/:name', function(req, res) {
    res.render('config-delete', { title: config.title, name: req.params.name });
});


// API Routes
app.get('/api/devices', async function(req, res) {
	try {
		var devices = await query("SELECT * FROM device");
		devices.forEach(function(device) {
			device.buttons = "<a href='/config/assign/" + device.uuid + "'><button type='button' class='btn btn-primary'>Assign Config</button></a>";
		});
		var json = JSON.stringify({ data: { devices: devices } });
		res.send(json);
	} catch (e) {
		console.error("Devices error:", e);
	}
});

app.post('/api/device/new', async function(req, res) {
	var sql = "INSERT INTO device (`uuid`, `config`) VALUES (?, ?)";
	var args = [req.body.uuid, req.body.config || null];
	var result = query(sql, args);
	if (result.affectedRows === 1) {
		// Success
	}
	console.log("New device result:", result);
	res.redirect('/devices');
});

app.get('/api/configs', async function(req, res) {
	try {
		var configs = await query("SELECT * FROM config");
		configs.forEach(function(config) {
			config.buttons = "<a href='/config/edit/" + config.name + "'><button type='button' class='btn btn-primary' data-toggle='modal' data-target='#editConfigModal'>Edit</button></a> \
                              <a href='/config/delete/" + config.name + "'><button type='button'class='btn btn-danger' data-toggle='modal' data-target='#deleteConfigModal'>Delete</button></a>";
		});
		var json = JSON.stringify({ data: { configs: configs } });
		res.send(json);
    } catch (e) {
		console.error("Configs error:", e);
	}
});

app.get('/api/config/:uuid', async function(req, res) {
    var uuid = req.params.uuid;
	var sql = "SELECT uuid FROM device WHERE uuid = ?";
	var args = [uuid];
	var device = await query(sql, args);
	if (device) {
		// Check if device config is empty, if not provide it as json response
		if (device.config) {
			sql = "SELECT * FROM config WHERE name = ? LIMIT 1";
			args = [device.config];
			var config = await query(sql, args);
			var json = JSON.stringify(config[0]);
			// TODO: Construct json config
			res.send(json);
		} else {
			var data = {
				status: "error",
				error: "Device not assigned to config!"
			}
			var json = JSON.stringify(data);
			res.send(json);
		}
	} else {
		// Device doesn't exist, create db entry
		sql = "INSERT INTO device (`uuid`, `config`) VALUES (?, ?)";
	    args = [uuid, null];
		var result = await query(sql, args);
		if (result.affectedRows === 1) {
			// Success
		}
		var data = {
			status: "error",
			error: "Device not assigned to config!"
		}
		var json = JSON.stringify(data);
		res.send(json);
	}
});

app.post('/api/config/assign/:uuid', async function(req, res) {
    var uuid = req.params.uuid;
    var config = req.body.config;
	var sql = "UPDATE device SET config = ? WHERE uuid = ?";
	var args = [config, uuid];
	var result = await query(sql, args);
	if (result.affectedRows === 1) {
		// Success
	}
    res.redirect('/devices');
});

app.post('/api/config/new', async function(req, res) {
	var sql = "INSERT INTO config (name, backend_url, port, heartbeat_max_time, pokemon_max_time, raid_max_time, startup_lat, startup_lon, token, jitter_value, max_warning_time_raid, encounter_delay, min_delay_logout, max_empty_gmo, max_failed_count, max_no_quests_count, logging_url, logging_port, logging_tls, logging_tcp, account_manager, deploy_eggs, nearby_tracker, auto_login, ultra_iv, ultra_quests)" +
			  "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
	var args = [];
	var keys = Object.keys(req.body);
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		var value = req.body[key];
		var booleans = ["logging_tls", "logging_tcp", "account_manager", "deploy_eggs", "nearby_tracker", "auto_login", "ultra_iv", "ultra_quests"];
		if (booleans.includes(key)) {
			args.push(value === 'on' ? 1 : 0);
		} else {
			args.push(value);
		}
	}
	var result = await query(sql, args);
	if (result.affectedRows === 1) {
	    console.log("Config inserted");
	} else {
		console.error("Failed to create new config");
	}
	res.redirect('/configs');
});

app.post('/api/config/edit/:name', async function(req, res) {
	var oldName = req.params.name;
	var sql = "UPDATE config SET name=?, backend_url=?, port=?, heartbeat_max_time=?, pokemon_max_time=?, raid_max_time=?, startup_lat=?, startup_lon=?, token=?, jitter_value=?, max_warning_time_raid=?, encounter_delay=?, min_delay_logout=?, max_empty_gmo=?, max_failed_count=?, max_no_quests_count=?, logging_url=?, logging_port=?, logging_tls=?, logging_tcp=?, account_manager=?, deploy_eggs=?, nearby_tracker=?, auto_login=?, ultra_iv=?, ultra_quests=? WHERE name=?";
	var args = [
		req.body.name,
		req.body.backend_url,
		req.body.port,
		req.body.heartbeat_max_time,
		req.body.pokemon_max_time,
		req.body.raid_max_time,
		req.body.startup_lat,
		req.body.startup_lon,
		req.body.token,
		req.body.jitter_value,
		req.body.max_warning_time_raid,
		req.body.encounter_delay,
		req.body.min_delay_logout,
		req.body.max_empty_gmo,
		req.body.max_failed_count,
		req.body.max_no_quests_count,
		req.body.logging_url,
		req.body.logging_port,
		req.body.logging_tls === "on" ? 1 : 0,
		req.body.logging_tcp === "on" ? 1 : 0,
		req.body.account_manager === "on" ? 1 : 0,
		req.body.deploy_eggs === "on" ? 1 : 0,
		req.body.nearby_tracker === "on" ? 1 : 0,
		req.body.auto_login === "on" ? 1 : 0,
		req.body.ultra_iv === "on" ? 1 : 0,
		req.body.ultra_quests === "on" ? 1 : 0,
		oldName
	];
	console.log("Old name:", oldName);
	var result = await query(sql, args);
	if (result.affectedRows === 1) {
		// Success
	}
	console.log("Edit config result:", result);
    res.redirect('/configs');
});

app.post('/api/config/delete/:name', async function(req, res) {
	var name = req.params.name;
	var sql = "DELETE FROM config WHERE name = ?";
	var args = [name];
	var result = await query(sql, args);
	if (result.affectedRows === 1) {
		// Success
	}
    res.redirect('/configs');
});

app.listen(config.port, () => console.log(`Listening on port ${config.port}...`));

/**
 * Device connects, if it isn't in db create it, error out in kevin with device config not assigned message.
 * 
 * Dashboard Page
 * - Device Count?
 * - Config Count?
 * 
 * Device Page
 * - Add device manually
 * - Edit Device (Optional)
 * - Delete Device
 * 
 * Settings Page
 */