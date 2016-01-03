"use strict";

var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");
var nodehttp = require('http');
var socketio = require("socket.io");
var GameLogic = require("./gameLogic.js");
var authentication = require("./authentication");

var app = express()
    .use(bodyParser.json())
    .use(bodyParser.urlencoded({ extended:true }))
    .use(cors());

authentication(app);

var http = nodehttp.Server(app);
var io = socketio(http);

var games = {};
var ioNamespaces = {};
var defaultId = "aa051eca-0dbb-4911-8351-f6deb9ad3b45";
games[defaultId] = new GameLogic(8, defaultId);

app.post('/memory/game', function(req, res) {
    console.log("New game initiated");

    let game = new GameLogic(8);
    let gameId = game.state.id;
    games[gameId] = game;

    game.events.on("changed", msg => console.log("Game state changed [" + msg.id + "]"));

    // Create new socket.io namespace
    var nsp = io.of('/' + gameId);
    nsp.on('connection', socket => {
        // Listen for and emit all game state changes
        let cb = function(state) {
            socket.emit("changed", state)
        };
        game.events.on("changed", cb);
        // Stop listening, if disconnect
        socket.on("disconnect", function() {
            game.events.removeListener("changed", cb);
        })
    });
    ioNamespaces[gameId] = nsp;

    res.send(game.getState());
});

app.get('/memory/game/:id', function(req, res) {
    console.log("Game state requested");

    let game = games[req.params.id];
    res.send(game.getState());
});

app.post('/memory/game/:id/move', function(req, res) {
    var move = req.body;
    let game = games[req.params.id];
    var promise = null;

    switch(move.type) {
        case "TURN_TILE":
            promise = game.turnTile(move.tileId);
            break;
    }

    if(promise) {
        promise
            .then(() => res.end())
            .catch((err) => res.status(500).send(err))
    } else {
        res.status(400).send("Invalid move type");
    }
});

http.listen(3000, function() {
    var port = http.address().port;
    console.log("Example app listening at http://localhost:%s", port);
});