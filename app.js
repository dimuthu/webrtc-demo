var express = require('express');
var app = require('express')();
var path = require('path');
var server = require('http').Server(app);
var io = require('socket.io')(server);

app.use(express.static(path.join(__dirname, 'public')));

var port = Number(process.env.PORT || 3000);
server.listen(port);

// send home page to client
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/views/index.html');
});

// room route handler
app.get('/room/:roomId', function (req, res) {
  res.sendfile(__dirname + '/views/room.html');
});

// starting websocket via socket.io
io.on('connection', function (socket) {

    // waiting for room callback to join users to related rooms
    socket.on('room', function(room){
        // getting currently connected clients
        var clients = io.sockets.adapter.rooms[room];

        // if there is a users in the room
        if(clients != undefined){
            // get the already connected user for the related room
            var connectedUserCount = Object.keys(clients).length;
            // if a user is waiting in the room, we send message to him informing about new user has connected to the room.
            if(connectedUserCount == 1){
                console.log('join to room:' + room);
                // join the current user to room
                socket.join(room);
                // send message to other party who is waiting for a candidate
                socket.broadcast.to(room).emit('new_user_connected', { new_user_connected: true });

            // room already have two users joined in so we reject connecting user and send him a message
            }else if(connectedUserCount > 1){
                socket.emit('room_full', { room_full: true });
            }

        // no any users in the room, we join current user to related room
        }else {
            console.log('join to room:' + room);
            socket.join(room);
        }
    });

    // exchanging start call message
    socket.on('call', function (data) {
        socket.broadcast.to(data.room_id).emit('call_' + data.room_id, data);
        console.log('call:' + data);
    });

    // exchanging answer call message
    socket.on('answer', function(data){
        socket.broadcast.to(data.room_id).emit('answer_' + data.room_id, data);
        console.log('answer:' + data);
    });

    // exchanging stop call message
    socket.on('connection_closed', function(data){
        socket.broadcast.to(data.room_id).emit('connection_closed_' + data.room_id, data);
        console.log('connection_closed:' + data);
    });

    // exchanging stop call message
    socket.on('ice_canditate', function(data){
        socket.broadcast.to(data.room_id).emit('ice_canditate_' + data.room_id, data);
        console.log('ice_canditate:' + data);
    });


});
