var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var fs = require('fs');
var xml2js = require('xml2js');
var SAPRestService = require('./model/SAPRestService.js');
var bo = require('./model/bo.js');
var log4js = require('log4js');
var log = log4js.getLogger("Web server");
log.setLevel("DEBUG");

var port = process.env.port || process.argv[2] || 1338 ;

var app = express();
app.use(log4js.connectLogger(log4js.getLogger("http"), { level: 'auto', format: ':method :url'}));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(express.static('public'));
//app.listen(port);

var os = require("os");
app.listen(8081, os.hostname());

//-------------------------------------------------------------------
//Remove below comments in case you want to enable cross domain call
//And give the URL of domain from where you are expecting the call.
//-------------------------------------------------------------------

//var allowCrossDomain = function (req, res, next) {
//    res.header('Access-Control-Allow-Origin', 'http://amit-pc:8000');
//    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
//    res.header('Access-Control-Allow-Headers', 'Content-Type');
//    next();
//}
//app.use(allowCrossDomain);

var selectedObjects;

// TODO: some kind of persistent data containing username and password.
var userName = "boUserName";
var password = "boPassword";

// TODO: some kind of persistent data containing accepted username and passwords for authentication to WDC.
var acceptedUsers = { 
    "kbui" : "kbui",
    "skalki" : "skalki",
    "kritiv" : "kritiv"
}

app.get('/', function (request, response) {    
    response.sendFile("views/BOT.html", {root: __dirname});
});

app.post('/api/cms', async function (req, response) {
    serverIP = req.body["Server"];
    cmsName = req.body["CMS"];
    universeName = req.body["UnxName"];
    universeId = req.body["UnxId"];

    if (acceptedUsers[req.body["UserName"]] == req.body["Password"]) {
        var metadataFile = "./UniverseMetdata/" + universeName + ".json";
        fs.access(metadataFile, fs.R_OK, function(e) {
            if (!e) {
                response.sendStatus(200);
            } else {
                log.error("Couldn't access metadata file " + metadataFile);
                response.sendStatus(500);
            }
        });
    } else {
        log.error("Invalid username or password");
        response.statusMessage = "Invalid username or password";
        response.sendStatus(500);
    }
});

app.get('/api/bo-fav/:favName', function(req, response) {        
    selectedObjects = bo.getFavorite(req.params.favName);
    response.send(selectedObjects);
});

app.post('/api/bo-fav', function(req, response) {
    var favName = req.body["favName"];
    selectedObjects = JSON.parse(req.body.data);
    bo.addToFavorite(favName, selectedObjects);
    response.send(true);
});

app.get('/api/bo-metadata', function (req, response) {
    console.log("get api/bo metadata:");
    var metadataFile = "./UniverseMetdata/" + universeName + ".json";
    var universeMetadata = JSON.parse(fs.readFileSync(metadataFile));    
    var metadataResponse = bo.getBOData(universeMetadata);
    response.json(metadataResponse);
});

app.post('/api/bo-ids', function (req, response) {
    selectedObjects = JSON.parse(req.body.data);
    response.send(true);
});

app.get('/api/bo-schema', async function (req, response) {
    var sapRestSvc = new SAPRestService(userName, password, serverIP, cmsName, universeId, selectedObjects);
    try {
        // node.js closes socket after 2 minutes, causing browser to resend ajax. This is to prevent it from resubmitting ajax call.
        response.setTimeout(0);
        await sapRestSvc.logon();
        var queryId = await sapRestSvc.createQuery();
        var schemas = await sapRestSvc.getQuerySchema(queryId);
        response.send(schemas); // not really understan
        await sapRestSvc.logoff();
    } catch (err) {
        handleError(err, response);
        await sapRestSvc.logoff();
    }
});

app.get('/api/bo-data', async function (req, response) {
    var sapRestSvc = new SAPRestService(userName, password, serverIP, cmsName, universeId, selectedObjects);
    try {
        // node.js closes socket after 2 minutes, causing browser to resend ajax. This is to prevent it from resubmitting ajax call.
        response.setTimeout(0);
        await sapRestSvc.logon();
        var queryId = await sapRestSvc.createQuery();
        var data = await sapRestSvc.getQueryData(queryId);
        response.send(data);
        await sapRestSvc.logoff();
    } catch (err) {
        console.log((err.response ? err.response.data.message : err.message));
        await sapRestSvc.logoff();
    }
});

function handleError(err, response) {
    var errMsg;
    var status = 500; // default generic code
    if (err.response) {
        status = err.response.status;
        if (err.response.data.message) {
            errMsg = err.response.data.message;
        } else {
            errMsg = err.response.data;
        }            
    } else {
        errMsg = err.message;
    }
    response.statusMessage = errMsg;
    response.status(status).end();
}