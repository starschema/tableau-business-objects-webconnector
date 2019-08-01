const axios = require('axios');
var xml2js = require('xml2js');
var parser = new xml2js.Parser();
var fs = require('fs');

var OBJECT_TEMPLATE = "<resultObject path=\"{OBJPATH}\" id=\"{OBJID}\"/>";
var FILTER_TEMPLATE = "<filterPart><predefinedFilter path=\"{FILTERPATH}\" id=\"{FILTERID}\"/></filterPart>";

/*
 * Note, don't know how this works, but if there's any error throw in any of these functions, the program will not
 * print any error but repeat silently, and infinitely, so BI sessions will just get created until it runs out.
 */
var SAPRestService = function (userName, password, serverIP, cmsName, universeId, selectedObjects) {
    this.userName = userName;
    this.password = password;
    this.serverIP = serverIP;
    this.cmsName = cmsName;
    this.universeId = universeId;
    this.selectedObjects = selectedObjects;
    this.ltoken = "";
}

SAPRestService.prototype.logon = function() {
    var h = this;

    var serverLogonURL = "http://" + this.serverIP + ":6405/biprws/logon/long";
    var xmlData = "<attrs xmlns='http://www.sap.com/rws/bip/'>" +
                            "<attr name='userName' type='string'>" + this.userName + "</attr>" +
                            "<attr name='password' type='string'>" + this.password + "</attr>" +
                            "<attr name='auth' type='string' possibilities='secEnterprise,secLDAP,secWinAD'>secEnterprise</attr>" +
                            "</attrs>";    
    var args = { headers: { "Content-Type": "application/xml" } };
    console.log(serverLogonURL);

    return axios.post(serverLogonURL, xmlData, args).then( // header must be passed as 3rd argument
        function(response) {
            h.ltoken = response.data.logonToken;
            console.log("Log on successful.");
        }
    );
}

SAPRestService.prototype.logoff = function () {
    if (this.ltoken != "") {
        var serverLogoutUrl = "http://" + this.serverIP + ":6405/biprws/logoff";
        var args = {           
            headers: { "Content-Type": "application/xml","X-SAP-LogonToken": this.ltoken }
        };
        console.log(serverLogoutUrl);

        return axios.post(serverLogoutUrl, "", args).then( // header must be passed as 3rd argument
            function(response) {
                this.ltoken = "";
                console.log("Log off successful.");
            }
        );
    }
}

SAPRestService.prototype.createQuery = function() {
    var serverQueryURL = "http://" + this.serverIP + ":6405/biprws/sl/v1/queries";
    console.log("query: " + serverQueryURL);

    var xmlData = this.createBOQueryXML();
    var args = {
        headers: { "Content-Type": "application/xml", "X-SAP-LogonToken": this.ltoken }
    };

    return axios.post(serverQueryURL, xmlData, args).then(
        function(response) {
            return response.data.success.id;
        }
    );
}

SAPRestService.prototype.createBOQueryXML = function() {
    var selObjs = this.selectedObjects;
    var xmlString = fs.readFileSync("BOBJQuery.xml").toString();
    var res = xmlString.replace("{UNX_ID}", this.universeId);
    var selectedObjString = "";
    var selectedFilterString = "";
    for (var i = 0; i < selObjs.length; i++) {
        if (selObjs[i].Type == 3) { // only 1 predefined filter can be used it seems?
            selectedFilterString = FILTER_TEMPLATE.replace("{FILTERID}", selObjs[i].Id).replace("{FILTERPATH}", selObjs[i].Path);
            console.log(selectedFilterString);
        } else {
            selectedObjString += OBJECT_TEMPLATE.replace("{OBJID}", selObjs[i].Id).replace("{OBJPATH}", selObjs[i].Path);
            console.log(selectedObjString);
        }
    }
    res = res.replace("{OBJECTS}", selectedObjString).replace("{FILTERS}", selectedFilterString);
    console.log(res);
    return res;
}

SAPRestService.prototype.getQueryData = function (queryId) {
    var h = this;
    var queryResultURL = "http://" + this.serverIP + ":6405/biprws/sl/v1/queries/" + queryId + "/data.svc/Flows0";
    console.log(queryResultURL);

    var args = {
        headers: { "Accept": "application/json", "Content-Type": "application/json", "X-SAP-LogonToken": this.ltoken }
    };

    return axios.get(queryResultURL, args).then(
        function(response) {
            var sanitized= response.data.d.results.map(function (e) {               
                delete e.__metadata;                
                return e;
            });
            return sanitized;
        }
    );
}

SAPRestService.prototype.getQuerySchema = function (queryId) {
    var h = this;
    var queryResultURL = "http://" + this.serverIP + ":6405/biprws/sl/v1/queries/" + queryId + "/data.svc/$metadata";
    console.log(queryResultURL);
    
    var args = { // must use application/xml because this request does not support json
        headers: { "Accept": "application/xml", "Content-Type": "application/json", "X-SAP-LogonToken": this.ltoken }
    };

    return axios.get(queryResultURL, args).then(
        function(response) {
            var headers = [];
            parser.parseString(response.data, function(err, result) {
                extractSchema(result, headers);
            });
            console.log(headers);
            return headers;
        }
    );
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

module.exports = SAPRestService;