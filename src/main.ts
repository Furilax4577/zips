// src/server.ts
import express from "express";
import * as http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { connect, MqttClient } from "mqtt";
import { randomUUID } from "crypto";

interface ZendureMqttConfig {
  appKey: string;
  secret: string;
  mqttUrl: string;
  port: number;
}

const PORT = process.env.PORT || 3000;
const clients = new Map<WebSocket, { uuid: string; mqttClient?: MqttClient }>();

// 1) Crée l'application Express
const app = express();

// Exemple de route Express classique
app.get("/", (req, res) => {
  res.send("Hello from Express + WS in TypeScript!");
});

// 2) Crée le serveur HTTP à partir de l'app Express
const server = http.createServer(app);

// 3) Attache un WebSocketServer sur ce serveur HTTP
const wss = new WebSocketServer({ server });

setInterval(() => {
  console.log(`Nombre de client connectés ${clients.size}`);
}, 60000);

// 4) Gérer la connexion WebSocket
wss.on("connection", (ws, request) => {
  console.log("Client WebSocket connecté");

  clients.set(ws, { uuid: randomUUID() });

  // Quand on reçoit un message du client
  ws.on("message", (message) => {
    console.log("Message reçu du client :", message.toString());

    const mqttConfig = JSON.parse(message.toString()) as ZendureMqttConfig;

    const mqttSession = connect(`mqtt://${mqttConfig.mqttUrl}`, {
      username: mqttConfig.appKey,
      password: mqttConfig.secret,
      port: mqttConfig.port,
      protocolId: "MQTT",
      protocolVersion: 5,
    });
    clients.get(ws)!.mqttClient = mqttSession;

    mqttSession.on("connect", () => {
      mqttSession.subscribe(`${mqttConfig.appKey}/#`, (error) => {
        if (!error) {
          console.log("Connected!");
        } else {
          console.log("Error:", error);
        }
      });
    });

    mqttSession.on("message", (topic, message) => {
      // message is Buffer
      console.log(topic);
      ws.send(
        JSON.stringify({ topic, message: JSON.parse(message.toString()) })
      );
    });

    mqttSession.on("error", (error) => {
      console.log("error", error);
    });
  });

  // Quand le client se déconnecte
  ws.on("close", () => {
    console.log("Client WebSocket déconnecté");
    if (clients.get(ws)?.mqttClient) {
      clients.get(ws)!.mqttClient!.end();
    }
    clients.delete(ws);
  });
});

// 5) Démarre le serveur
server.listen(PORT, () => {
  console.log(`Serveur Express + WebSocket démarré sur le port ${PORT}`);
});
