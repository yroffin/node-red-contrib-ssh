'use strict';

module.exports = function (RED) {
    function NodeRedSsh(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.status({ fill: "red", shape: "dot", text: "waiting" });

        var Client = require('ssh2').Client;

        // Session handler
        var session = {
            code: 0,
            stdout: [],
            stderr: []
        };
        var notify = (type, data) => {
            switch (type) {
                case 0:
                    session.code = data;
                    node.send(session);
                    session = {
                        code: 0,
                        stdout: [],
                        stderr: []
                    };
                    break;
                case 1:
                    session.stdout.push(data.toString());
                    break;
                case 2:
                    session.stderr.push(data.toString());
                    break;
            }
        };

        // Ssh client handler
        var conn = new Client();
        conn.on('ready', () => {
            node.status({ fill: "green", shape: "dot", text: 'Ready' });
            node.on('input', (msg) => {
                conn.exec(msg.payload, (err, stream) => {
                    if (err) throw err;
                    stream.on('close', function (code, signal) {
                        node.warn('Stream :: close :: code: ' + code + ', signal: ' + signal);
                        conn.end();
                        notify(0, code);
                    }).on('data', (data) => {
                        node.status({ fill: "green", shape: "dot", text: data.toString() });
                        notify(1, data);
                    }).stderr.on('data', (data) => {
                        node.status({ fill: "black", shape: "dot", text: data.toString() });
                        notify(2, data);
                    });
                });
            })
        });

        conn.on('close', (err) => {
            node.warn('Ssh client close', err);
        });

        conn.on('error', (err) => {
            node.warn('Ssh client error', err);
        });

        conn.connect({
            host: config.hostname,
            port: 22,
            username: node.credentials.username ? node.credentials.username : undefined,
            password: node.credentials.password ? node.credentials.password : undefined,
            privateKey: config.key ? require('fs').readFileSync(config.key) : undefined
        });

        // Handle node close
        node.on('close', function () {
            node.warn('Ssh client dispose', err);
            conn ? conn.close() : undefined;
            conn ? conn.dispose : undefined;
        });
    }

    // Register this node
    RED.nodes.registerType("ssh-client", NodeRedSsh, {
        credentials: {
            email: { type: "text" },
            username: { type: "text" },
            password: { type: "password" }
        }
    });
}