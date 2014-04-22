// ***
// *** Required modules
// ***
var express = require('express');
var OpenTokLibrary = require('opentok');
var cors = require('cors');

// ***
// *** OpenTok Constants for creating Session and Token values
// ***
var OTKEY = process.env.TB_KEY;
var OTSECRET = process.env.TB_SECRET;
var OpenTokObject = new OpenTokLibrary(OTKEY, OTSECRET);

// ***
// *** Setup Express to handle static files in public folder
// *** Express is also great for handling url routing
// ***
var app = express();
app.set( 'views', __dirname + "/views");
app.set( 'view engine', 'ejs' );
app.use(express.static(__dirname + '/public'));


app.use(cors({methods:'GET'}));

// if we are in Heroku on production, and the request isn't over TLS, redirect.
app.get('*', function(req, res, next) {
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect('https://opentokrtc.com');
  }
  next();
});

app.get(/.*\.json$/, function(req, res, next) {
  req.format = 'json';
  next();
});

// anything with p2p in the first path segment, has only one path segment, and can only end with
// extension .json
// NOTE: this can probably be done more readibly if we catch all requests and use the `path` module
// to structure the request for us. this approach favors utilizing express' routers existing logic.
app.get(/^\/.*p2p[^\/.]*(\.json)?$/, function(req, res, next) {
  console.log('a p2p room was requested');
  if (!('sessionProperties' in req)) req.sessionProperties = {};
  req.sessionProperties.p2p = true;
  next();
});


// ***
// *** When user goes to root directory, render index page
// ***
app.get("/", function( req, res ){
  res.render('index');
});

var rooms = {};

app.get("/:rid", function( req, res ){
  console.log( req.url );

  var rid = req.params.rid.split('.json')[0];
  var room_uppercase = rid.toUpperCase();

  // Generate sessionId if there are no existing session Id's
  if( !rooms[room_uppercase] ){
    OpenTokObject.createSession( req.sessionProperties || {} , function(err, session){
      if (err) {
        return res.send(500, "could not generate opentok session");
      }
      console.log('opentok session generated:', session.sessionId);
      rooms[ room_uppercase ] = session.sessionId;
      returnRoomResponse( res, { rid: rid, sid: session.sessionId }, req.format);
    });
  }else{
    returnRoomResponse( res, { rid: rid, sid: rooms[rid.toUpperCase()] }, req.format);
  }
});

function returnRoomResponse(res, data, format) {
  data.apiKey = OTKEY;
  data.token = OpenTokObject.generateToken(data.sid, { role: 'moderator' });
  if (format === 'json') {
    res.json(data);
  } else {
    res.render('room', data);
  }
}

// ***
// *** start server, listen to port (predefined or 9393)
// ***
var port = process.env.PORT || 5000;
app.listen(port);
