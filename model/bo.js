var _ = require("underscore");

var BO_OBJECT_TYPE =
{
    Folder : 0,
    Attribute : 1,
    Measure : 2,
    Filter: 3,
    Favorite: 4
}

var favoriteFolder = {
    Id: "Favorites", data: "Favorites",
    attr: { Id: "Favorites", selected: false, type: BO_OBJECT_TYPE.Folder, path: "" }
};

var favorites = [];

module.exports = {
    getBOData: function (metadata) {
        return generateFolderTree(metadata["folders"]["folders"]);
    },

    getFavorite: function(favName) {        
        for (var i = 0; i < favorites.length; i++) {                   
            if (favorites[i].name == favName) {
                return favorites[i].selectedObjects;
            }
        }
        return null;
    },

    addToFavorite: function(favName, selectedObjects) {        
        var favItem = {
            Id: favName,
            data: favName,
            attr: {
                Id: favName,
                selected: false,
                type: BO_OBJECT_TYPE.Favorite,
                path: ""
            }
        }
        if (!favoriteFolder.children) {
            favoriteFolder.children = [];
        }
        favoriteFolder.children.push(favItem);
        favorites.push({ name: favName, selectedObjects: selectedObjects });        
    }
}

var generateFolderTree = function (folders) {
    var folderTree = [];
    folderTree.push(favoriteFolder);

    for (var i in folders) {
        var folder = folders[i];
        //If the folder is top-level(having no parent) folder we generate the corresponding tree
        if (_.isUndefined(folder["parentName"])) {
            folderTree.push(createFolderStructure(folders, folder))
        }
    }
    return folderTree;
}

var createFolderStructure = function(folders, root) {
    var attributes = root["attributes"];
    var measures = root["measures"];
    var filters = root["filters"];
    var name = root["name"].trim();

    var folderObject = {
        Id: name,
        data: name,
        attr: {
            Id: name,
            selected: false,
            type: BO_OBJECT_TYPE.Folder,
            path: ""
        }
    }
    var children = [];
    children = children.concat(addAttributeChildren(name, attributes));
    children = children.concat(addMeasureChildren(name, measures));

    //We're going to find the children of folder and continue generating structure recursively
    for (var i in folders) {
        var model = folders[i];
        if (_.isString(model["parentName"]) && model["parentName"].trim() === name) {
            var child = createFolderStructure(folders, model);
            if(child.children.length > 0){
                children = children.concat(child);
            }
        }
    }
    
    children = children.concat(addFilterChildren(name, filters)); // want to add filter as last
    folderObject.children = children;
    return folderObject;
}

var addAttributeChildren = function (name, attributes) {
    var children = [];
    if (_.isArray(attributes)) {
        for (var i in attributes) {
            var attribute = createFolderPropertyObject(attributes[i]);
            attribute.attr.path = "folder\\" + name + "|dimension";
            attribute.attr.type = BO_OBJECT_TYPE.Attribute;
            children.push(attribute);
        }
    }
    return children;
}

var addMeasureChildren = function (name, measures) {
    var children = [];
    if (_.isArray(measures)) {
        for (var i in measures) {
            var measure = createFolderPropertyObject(measures[i]);
            measure.attr.path = "folder\\" + name + "|measure";
            measure.attr.type = BO_OBJECT_TYPE.Measure;
            children.push(measure);
        }
    }
    return children;
}

var addFilterChildren = function (name, filters) {    
    var filterFolder = {
        Id: "Filters",
        data: "Filters",
        attr: {
            Id: "Filters",
            selected: false,
            type: BO_OBJECT_TYPE.Folder,
            path: ""
        }
    }

    var children = [];
    if (_.isArray(filters)) {
        for (var i in filters) {
            var filter = createFolderPropertyObject(filters[i]);
            filter.attr.path = "folder\\" + name + "|filter";
            filter.attr.type = BO_OBJECT_TYPE.Filter;
            children.push(filter);
        }
    }
    if (children.length > 0) {
        filterFolder.children = children;
        return filterFolder;
    }
    return children;
}

var createFolderPropertyObject = function (property) {
    return {
        Id: property["Id"],
        data: property["Name"],
        children: [],
        attr: {
            Id: property["Id"],
            selected: false,
            type: undefined,
            path: undefined
        }
    }
}
