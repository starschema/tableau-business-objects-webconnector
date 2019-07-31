var Client = require('node-rest-client').Client;
var xml2js = require('xml2js');
var client = new Client();
var parser = new xml2js.Parser();
var fs = require('fs');

var OBJECT_TEMPLATE = "<resultObject path=\"{OBJPATH}\" id=\"{OBJID}\"/>";
var FILTER_TEMPLATE = "<filterPart><predefinedFilter path=\"{FILTERPATH}\" id=\"{FILTERID}\"/></filterPart>";

var Bot = function (userName, password, serverIP, cmsName, universeId, selectedObjects) {
    this.userName = userName;
    this.password = password;
    this.serverIP = serverIP;
    this.cmsName = cmsName;
    this.universeId = universeId;
    this.selectedObjects = selectedObjects;
    this.ltoken = "";
    this.ltoken2 = "";
}

Bot.prototype.GetBOBJData = function (_finalCallback) {
    if (this.ltoken === "") {
        this.SAPLogon(this.CreateAndSubmitQuery, this.GetQueryResponse, _finalCallback);
    }
}

Bot.prototype.SAPLogon = function(createQuery, runQuery, _finalCallback) {
    var h = this;

    var serverLogonURL = "http://" + this.serverIP + ":6405/biprws/logon/long";
    var strXML = "<attrs xmlns='http://www.sap.com/rws/bip/'>" +
                            "<attr name='userName' type='string'>" + this.userName + "</attr>" +
                            "<attr name='password' type='string'>" + this.password + "</attr>" +
                            "<attr name='auth' type='string' possibilities='secEnterprise,secLDAP,secWinAD'>secEnterprise</attr>" +
                            "</attrs>";    
    var args = {data: strXML, headers: { "Content-Type": "application/xml" }};
        
    client.post(serverLogonURL, args, function (data, response) {
        if (response.statusCode == 200) {
            var str = String.fromCharCode.apply(null, data);
            parser.parseString(str);
            var token = parser.resultObject.entry.content[0].attrs[0].attr[0]._;
            h.ltoken2 = token;
            h.ltoken = "\"" + token + "\"";
            if (h.ltoken != "") {
                createQuery.apply(h, [runQuery, _finalCallback]); // need to use apply to send "this" object for callback fn
            }
        }else{
            if (response.statusCode == 401) {
                console.error('ERROR Wrong credentials! ', data);
                _finalCallback.status(401).send(data);
            }else{
                console.error('ERROR During authentication!', data);
                _finalCallback.status(500).send(data);
            }
        }
    });
}

Bot.prototype.CreateAndSubmitQuery = function (runQuery, _finalCallback) {
    var boQuery = this.CreateBOQueryXML(); 
    var queryId = this.SubmitBOQueryXML(boQuery, runQuery, _finalCallback);
    
}


Bot.prototype.CreateBOQueryXML = function () {
    var selObjs = this.selectedObjects;
    var xmlString = fs.readFileSync("BOBJQuery.xml").toString();
    var res = xmlString.replace("{UNX_ID}", this.universeId);
    var selectedObjString = "";
    var selectedFilterString = "";
    for (var i = 0; i < selObjs.length; i++) {
        if (selObjs[i].Type == 3) { // only 1 predefined filter can be used.
            selectedFilterString = FILTER_TEMPLATE.replace("{FILTERID}", selObjs[i].Id).replace("{FILTERPATH}", selObjs[i].Path);
        } else {
            selectedObjString += OBJECT_TEMPLATE.replace("{OBJID}", selObjs[i].Id).replace("{OBJPATH}", selObjs[i].Path);
        }
    }
    res = res.replace("{OBJECTS}", selectedObjString).replace("{FILTERS}", selectedFilterString);
    return res;
}

Bot.prototype.SubmitBOQueryXML = function (bobjQuery, runQuery, _finalCallback) {
    var h = this;
    
    var serverQueryURL = "http://" + this.serverIP + ":6405/biprws/sl/v1/queries";
    console.log("query: " + bobjQuery);
    var args = {
        data: bobjQuery,
        headers: { "Content-Type": "application/xml", "X-SAP-LogonToken": this.ltoken }
    };
    
    var qId;
    client.post(serverQueryURL, args, function (data, response) {
        if (response.statusCode == 200) {
            qId = data.success.id[0];
            runQuery.apply(h, [qId, _finalCallback]);
        }else{
			console.error('ERROR During submitting the query!', data);
		    _finalCallback.status(500).send(data);
		}
    });
}

Bot.prototype.GetQueryResponse = function (queryId, _finalCallback) {
    var h = this;
    var queryResultURL = "http://" + this.serverIP + ":6405/biprws/sl/v1/queries/" + queryId + "/data.svc/Flows0";
    
    
    var args = {
        headers: { "Accept": "application/json", "Content-Type": "application/json", "X-SAP-LogonToken": this.ltoken }
    };
    
    client = new Client();    
    client.get(queryResultURL, args, function (data, response) {
        if (response.statusCode == 200) {
            var sanitized= data.d.results.map(function (e) {               
                delete e.__metadata;                
                return e;
            });
            if (typeof _finalCallback !== 'undefined') {
                _finalCallback.send(sanitized);
            }
        }else{
			console.error('ERROR During getting the query response!', data);
		    _finalCallback.status(500).send(data);
		}
        h.SAPLogoff();
    });
}

Bot.prototype.GetBOBJSchema = function (_finalCallback) {
    if (this.ltoken === "") {
        this.SAPLogon(this.CreateAndSubmitQuery, this.GetSchemaResponse, _finalCallback);
    }
}

Bot.prototype.GetSchemaResponse = function (queryId, _finalCallback) {
    var h = this;
    var queryResultURL = "http://" + this.serverIP + ":6405/biprws/sl/v1/queries/" + queryId + "/data.svc/$metadata";
    
    
    var args = { // must use application/xml because this request does not support json
        headers: { "Accept": "application/xml", "Content-Type": "application/json", "X-SAP-LogonToken": this.ltoken }
    };
    
    client = new Client();    
    client.get(queryResultURL, args, function (data, response) {
        if (response.statusCode == 200) {
            // Use this commented block for the hard-coded version of extractSchema().
            /*var properties = data["edmx:Edmx"]
                            ["edmx:DataServices"][0]
                            ["Schema"][0]
                            ["EntityType"][0]
                            ["Property"];
            for (var i = 0; i < properties.length; i++) {
                console.log(properties[i]["$"]);
            }*/
            var headers = [];
            extractSchema(data, headers);
            console.log(headers);
            _finalCallback.send(headers);
        }else{
            console.error('ERROR During getting the query response!', data);
            _finalCallback.status(500).send(data);
        }
        h.SAPLogoff();
    });
}

function extractSchema(metadata, headers) {
    if (metadata instanceof Array) {
        for (var i = 0; i < metadata.length; i++) {
            extractSchema(metadata[i], headers);
        }
    } else {
        for (var prop in metadata) {            
            if (prop == "Property") {
                for (var i = 0; i < metadata[prop].length; i++) {
                    var obj = metadata[prop][i]["$"];                    
                    headers.push({"Name": obj.Name, "Type": obj.Type, "Qualification": obj["sap:qualification"]});
                }
            } else if (metadata[prop] instanceof Object) {
                extractSchema(metadata[prop], headers);
            }
        }
    }
}

Bot.prototype.SAPLogoff = function () {
    if (this.ltoken != "") {
        var serverLogonURL = "http://" + this.serverIP + ":6405/biprws/logoff";
        var args = {           
            headers: { "Content-Type": "application/xml","X-SAP-LogonToken": this.ltoken }
        };

        client.post(serverLogonURL, args, function (data, response) {
            if (response.statusCode == 200) {
                this.ltoken = "";
                console.log("log off successful");
            }
        });
    }
}

module.exports = Bot;