# SAP BO to Tableau Connector (BOT connector)

BOT connector provides facility to the user to connect SAP BO Universe to Tableau Desktop. Using this connector user can take advantage of both BI platforms. Here power of SAP backend + Metadata is merged with strong visualization of Tableau.

![BOT architecture](/bot-architecture.png)

This connector has two parts:

## 1. BO Universe extraction

This module will extract the BO universe metadata information like Dimension and  Measures and save them into JSON. This module will be deployed as scheduler on user machine. This scheduler will run nightly or on demand.
For more information please visit the [BO Universe Extractor](https://github.com/starschema/business-objects-universe-extractor) page.

## 2. Tableau Connector

BOT connector connects the SAP BO Universe with Tableau so end users can easily access and analyze data.BOT connector is a web application which shows SAP Universe objects as data elements. 


## Prerequisites

* [Node.js](https://nodejs.org/en/download/)
* [BO Universe Extractor](https://github.com/starschema/business-objects-universe-extractor) (for getting universe metadata in json)
* [Tableau Desktop](https://onlinehelp.tableau.com/current/desktopdeploy/en-us/desktop_deploy_download_and_install.htm)

## Getting started
Let's say you want to connect `xUniverse` to tableau.

1. First you need to run `BO Universe Extractor` to get the universe metadata in json for universe `xUniverse`. For more information check the [BO Universe Extractor](https://github.com/starschema/business-objects-universe-extractor).
2. When you got the json (XUNIVERSE.json) you should copy it to the UniverseMetdata folder. 
3. After that you should run commands (in the root folder of the project):
```
npm install
node server.js
```
 If you did everything right you can see the login page on port 1338 where you run the node js server e.g.: http://yourNodeServer:1338.
4.  Open Tableau Desktop.
5. At the left menu, under 'To a Server' choose 'Web Data Connector'.
6. Here type in your WDC url (http://yourNodeServer:1338). Now you can see the login page here. For more info about the credentials please check [The login page](#the-login-page) paragraph below. 
7. After you logged in you should see a tree where you can add the objects which you want to see as data elements in Tableau.
8. After you done click 'Go get it!' button.
9. Done! Now you can see SAP Universe objects in Tableau.


###The login page

On the login page you have to set 6 fields:
* `Server` :  The server host or ip where the BO Server is. e.g.: 192.168.223.117
* `CMS` :  The CMS name (not mandatory to add, this can be the same as `Server`).
* `UserName` : The username to the BO Server.
* `Password` : The password to the BO Server.
* `Universe Name` : The name of the universe you want to load into Tableau (in our example `xUniverse`).
* `Universe Id` : The ID of the universe (ID of `xUniverse`). You can check the ID in [BOE Central Management Console](https://docs.bmc.com/docs/display/public/bdsda83/Accessing+the+Central+Management+Console)  interface, in the Universes panel, by right clicking on the given universe (`xUniverse`) and check Properties. 
