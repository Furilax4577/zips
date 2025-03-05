// src/server.ts
import express from "express";
import * as http from "http";
import { WebSocketServer } from "ws";
import { connect, MqttClient } from "mqtt";

interface ZendureMqttConfig {
  appKey: string;
  secret: string;
  mqttUrl: string;
  port: number;
}

const PORT = process.env.PORT || 3000;
const mqttSessions: { [key: string]: MqttClient } = {};

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

// 4) Gérer la connexion WebSocket
wss.on("connection", (socket) => {
  console.log("Client WebSocket connecté");

  // Quand on reçoit un message du client
  socket.on("message", (message) => {
    console.log("Message reçu du client :", message.toString());

    const mqttConfig = JSON.parse(message.toString()) as ZendureMqttConfig;

    const mqttSession = connect(`mqtt://${mqttConfig.mqttUrl}`, {
      username: mqttConfig.appKey,
      password: mqttConfig.secret,
      port: mqttConfig.port,
      protocolId: "MQTT",
      protocolVersion: 5,
    });

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
      socket.send(
        JSON.stringify({ topic, message: JSON.parse(message.toString()) })
      );
      mqttSession.end();
    });

    mqttSession.on("error", (error) => {
      console.log("error", error);
    });
  });

  // Quand le client se déconnecte
  socket.on("close", () => {
    console.log("Client WebSocket déconnecté");
  });
});

// 5) Démarre le serveur
server.listen(PORT, () => {
  console.log(`Serveur Express + WebSocket démarré sur le port ${PORT}`);
});
