jQuery(document).ready(function($){
    // home page script goes here
    if($('body').hasClass('home')){

        // click event on start new conversation button
        $('#start-new').on('click', function(e){
            e.preventDefault();
            // creating a random string and add it to modal dialogue
            $('#room-id-label').html(Math.random().toString(36).substr(2, 6));
            // show the bootstrap modal dialogue
            $('#start-call-modal').modal();
        });

        // click event on go to room button
        $('#go-to-room-button').on('click', function(){
            // user is redirecting to related room URL
            window.location = window.location + 'room/' + $('#room-id-label').html();
        });

        // click event on join to a call button
        $('#join-call').on('click', function(){
            var roomId = $('#room-id-input').val();
            if(roomId === ''){
                alert('Please, enter a Room ID to join');
                return false;
            }else{
                // user is redirecting to related room URL
                window.location = window.location + 'room/' + roomId;
            }
        });
    }

    // chat room scripts goes here
    if($('body').hasClass('room')){

        var currentUrl = window.location.pathname; // get current URL
        // extracting room id from the URL
        var roomId = currentUrl.substr(currentUrl.lastIndexOf('/') + 1);

        // Here we listing down some free STUN/TURN servers
        var configuration = {
          'iceServers': [
            {url: "stun:23.21.150.121"},
            {url: "stun:stun.l.google.com:19302"},
            {url: "turn:numb.viagenie.ca", credential: "colombo", username: "dimuthu.nilanka@gmail.com"}
          ]
        };

        // SDP settings object
        var sdpConstraints = {
            optional: [],
            mandatory: {
                OfferToReceiveAudio: true,
                OfferToReceiveVideo: true
            }
        };

       var options = {
            optional: [
                { DtlsSrtpKeyAgreement: true },
                { RtpDataChannels: true } //required for Firefox
            ]
        };

        var localStream = null;

        // creating a web-socket between browser and signalling server
        var socket = io.connect(window.location.origin);

        // sending room id to signalling server
        socket.emit('room', roomId);

        // room full message handler
        socket.on('room_full', function(data){
            alert('Sorry, room is full.');
            window.location = '/';
        });

        // waiting for new user to connect and show a message when user connected
        socket.on('new_user_connected', function(data){
            alert('A new user has connected to your room. Please start the call.');
        });

        // creating a new Peer2Peer Connection
        var conn = new RTCPeerConnection(configuration, options);

        // event handler for ICECandidates
        conn.onicecandidate = function(event) {
            var candidate = event.candidate;
            // send ICE candidates to the remote side via signalling
            if(candidate) {
                socket.emit('ice_canditate', {candidate: candidate, room_id: roomId});
            }
        };

        // when receiving ICECandidates from remote end via signalling we will add them to local peer connection
        socket.on('ice_canditate_'+ roomId, function(data){
            if(data.candidate){
                var candidate     = data.candidate.candidate;
                var sdpMLineIndex = data.candidate.sdpMLineIndex;
                var iceCandidate = new RTCIceCandidate({
                    sdpMLineIndex: sdpMLineIndex,
                    candidate    : candidate
                });
                conn.addIceCandidate(iceCandidate);
            }
        });

        // event handler for remote stream add event
        conn.onaddstream = function(event) {
            // here we are adding remote video stream to answer video element
            var answerVideo = document.getElementById('answer-video');
            // poly-fill for adding media stream
            attachMediaStream(answerVideo, event.stream);
        };

        // getting user media and add it to peer connection
        getUserMedia(
            {audio: true, video: true},
            function(stream){
                var callerVideo = document.getElementById('caller-video');
                localStream = stream;
                attachMediaStream(callerVideo, localStream);
                conn.addStream(localStream);
            },
            function(error){
                console.log(error);
            }
        );

        // start call button click event handler
        $('#start-call').on('click', function(){
            // create a offer request and send it to other party via signalling server
            conn.createOffer(function(offerSDP) {
                conn.setLocalDescription(offerSDP);
                // send message to signalling server via web-socket
                socket.emit('call', { offerSDP: offerSDP, room_id: roomId });
            },
            function(error){
             console.log(error);
            },
            sdpConstraints);

            // update UI button views
            $('#start-call').hide();
            $('#stop-call').css('display', 'block');
        });

        // this event waiting for call to start by other party
        socket.on('call_' + roomId, function (data) {
            var remoteDescription = new RTCSessionDescription(data.offerSDP);
            conn.setRemoteDescription(remoteDescription);

            // send the answer to P2P calling party via signalling server
            conn.createAnswer(function(answerSDP) {
                conn.setLocalDescription(answerSDP);
                // send message to signalling server via web-socket
                socket.emit('answer', {answerSDP: answerSDP, room_id: roomId });
            },
            function (error){
                console.log(error);
            },
            sdpConstraints);

            // update UI button views
            $('#start-call').hide();
            $('#stop-call').css('display', 'block');
        });

        // event for receiving answering party's answer via signalling server
        socket.on('answer_' + roomId, function(data){
            var remoteDescription = new RTCSessionDescription(data.answerSDP);
            conn.setRemoteDescription(remoteDescription);
        });

        // stop calling button click event handler
        $('#stop-call').on('click', function(){
            // stop local video stream and send the message to other party via signalling
            localStream.stop();
            socket.emit('stream_closed', { room_id: roomId });

            // Reset and update UI
            $('#caller-video').attr('src', '');
            $('#answer-video').attr('src', '');
            $('#start-call').css('display', 'block');
            $('#stop-call').hide();
        });

        // listing to other party's connection close event
        socket.on('stream_closed_' + roomId, function(data){
            // stop localStream
            localStream.stop();

            // Reset and update UI
            $('#caller-video').attr('src', '');
            $('#answer-video').attr('src', '');
            $('#start-call').css('display', 'block');
            $('#stop-call').hide();
        });

    }
});
