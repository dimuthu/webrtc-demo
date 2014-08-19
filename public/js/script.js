jQuery(document).ready(function($){
    // home page script goes here
    if($('body').hasClass('home')){

        // click event on start new conversation button
        $('#start-new').on('click', function(e){
            e.preventDefault();
            // creating a random string and add it to modal dialog
            $('#room-id-label').html(Math.random().toString(36).substr(2, 6));
            // show the bootstrap modal dialog
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
        })
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

        // sdp settings object
        var sdpConstraints = {
            optional: [],
            mandatory: {
                OfferToReceiveAudio: true,
                OfferToReceiveVideo: true
            }
        };

       var options = {
            optional: [
                {DtlsSrtpKeyAgreement: true},
                {RtpDataChannels: true} //required for Firefox
            ]
        };

        // creating a new Peer2Peer Connection
        var conn = null;

        // creating a websocket between browser and signaling server
        var socket = io.connect(window.location.origin); // local URL
        //var socket = io.connect('http://localhost:3000'); // heroku URL

        // sending room id to signaling server
        socket.emit('room', roomId);

        // room full event handler
        socket.on('room_full', function(data){
            alert('Sorry, room is full.');
            window.location = '/';
        });

        // this event waiting for new user to connect and show a message when user connected
        socket.on('new_user_connected', function(data){
            alert('New user has connected to your room. Please start the call.');
        });

        // start call button click event handler
        $('#start-call').on('click', function(){
            conn = new RTCPeerConnection(configuration, options);
            conn.onicecandidate = onIceCandidateHandler;
            conn.onaddstream = onAddStreamHandler;

            var callerVideo = $('#caller-video');
            // polyfill for getting user media
            getUserMedia(
                {audio: true, video: true},
                function(stream){
                    if (window.URL) {
                        // add local video stream to small video element
                        callerVideo.attr('src', window.URL.createObjectURL(stream));
                        // add local video stream to P2P connection
                        conn.addStream(stream);
                    } else {
                        // add local video stream to small video element
                        callerVideo.attr('src', stream);
                        // add local video stream to P2P connection
                        conn.addStream(stream);
                    }

                    // create a offer request and send it to other party via signaling server
                    conn.createOffer(function(offerSDP) {
                        conn.setLocalDescription(offerSDP);
                        // send message to signaling server via websocket
                        socket.emit('call', { offerSDP: offerSDP, room_id: roomId });
                    },
                    function(error){
                     console.log(error);
                    },
                    sdpConstraints);

                    // update UI button views
                    $('#start-call').hide();
                    $('#stop-call').css('display', 'block');
                },
                function(error){
                    console.log(error);
                }
            );
        });

        // this event waiting for call to start by other party
        socket.on('call_' + roomId, function (data) {
            console.log('call_'+roomId + '::' + data);
            conn = new RTCPeerConnection(configuration, options);
            conn.onicecandidate = onIceCandidateHandler;
            conn.onaddstream = onAddStreamHandler;

            var callerVideo = $('#caller-video');

            // polyfill for getting user media
            getUserMedia(
                {audio: true, video: true},
                function(stream){
                    if (window.URL) {
                        // add local video stream to small video element
                        callerVideo.attr('src', window.URL.createObjectURL(stream));
                        // add local video stream to P2P connection
                        conn.addStream(stream);
                    } else {
                        // add local video stream to small video element
                        callerVideo.attr('src', stream);
                        // add local video stream to P2P connection
                        conn.addStream(stream);
                    }

                    // get the offer from P2P calling party
                    var remoteDescription = new RTCSessionDescription(data.offerSDP);
                    conn.setRemoteDescription(remoteDescription);

                    // send the answer to P2P calling party via signaling server
                    conn.createAnswer(function(answerSDP) {
                        conn.setLocalDescription(answerSDP);
                        // send message to signaling server via websocket
                        socket.emit('answer', {answerSDP: answerSDP, room_id: roomId });
                    },
                    function (error){
                        console.log(error);
                    },
                    sdpConstraints);

                    // update UI button views
                    $('#start-call').hide();
                    $('#stop-call').css('display', 'block');
                },
                function(error){
                    console.log(error);
                }
            );

        });

        // event for receiving answering party's answer via signaling server
        socket.on('answer_' + roomId, function(data){
            console.log('answer_'+roomId + '::' + data);
            var remoteDescription = new RTCSessionDescription(data.answerSDP);
            conn.setRemoteDescription(remoteDescription);
        });

        // event handler for remote stream add event
        function onAddStreamHandler(stream) {
            // here we are adding remote video stream to answer video element
            var answerVideo = $('#answer-video');
            // polyfill for adding media stream
            console.log(stream);
            if(window.URL){
                answerVideo.attr('src', window.URL.createObjectURL(stream.stream));
            }else{
                answerVideo.attr('src', stream.stream);
            }
            // attachMediaStream(answerVideo, stream.stream);
        };

        // event handler for remote stream add event
        function onIceCandidateHandler(event) {
            var candidate = event.candidate;
            if(candidate) {
                socket.emit('ice_canditate', {candidate: candidate, room_id: roomId});
            }
        };

        socket.on('ice_canditate_'+ roomId, function(data){
            console.log('ice_candidate_'+roomId + '::' + data);
            if(data.candidate){
                var candidate     = data.candidate.candidate;
                var sdpMLineIndex = data.candidate.sdpMLineIndex;
                var iceCandidate = new RTCIceCandidate({
                    sdpMLineIndex: sdpMLineIndex,
                    candidate    : candidate
                });
                console.log(iceCandidate);
                conn.addIceCandidate(iceCandidate);
            }
        });

        // stop calling button click event handler
        $('#stop-call').on('click', function(){
            // closing the P2P connection
            conn.close();
            // Reset and update UI
            $('#caller-video').attr('src', '');
            $('#answer-video').attr('src', '');
            $('#start-call').css('display', 'block');
            $('#stop-call').hide();

            // send stop calling information to other party via signaling server
            socket.emit('connection_closed', { room_id: roomId });
        });

        // listing to other party's connection close event
        socket.on('connection_closed_' + roomId, function(data){
            console.log('connection_closed_'+roomId + '::' + data);
            // closing P2P connection from our side too
            conn.close();
            // Reset and update UI
            $('#caller-video').attr('src', '');
            $('#answer-video').attr('src', '');
            $('#start-call').css('display', 'block');
            $('#stop-call').hide();
        });

    }
});
