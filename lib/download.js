"use strict";

var Q			= require('q');
var _			= require('underscore');

var utilities	                    = require('./utilities.js');
var Constants                       = require('./SingleConstants.js');
var lrException                     = require('./error-exception.js');
var cache	                    	= require('./cache.js');
var getData							= require('./getData.js');

var LrClassNameConfig	    		= require('./SingleLrClassNameConfig.js');
var globalSites						= require('./SingleSites.js');

var globalStructures				= require('./SingleStructures.js');
var globalTemplates					= require('./SingleTemplates.js');

var Config							= require('./SingleConfig.js');


var globalCompanyId					= 0;

var download = {


	downloadAllFromServer: function () {
		
		utilities.writeToScreen('Getting data from server', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_INFO'));

		Q.resolve()
			.then(cache.clearCache)
			.then(download.getClassNameIds)
			.then(download.getUserSites)
			.then(download.getCompanyGroup)
			.then(download.getStructures)
			.then(download.getTemplates)
			.then(function () {

			})
			.done(function () {
				var router = require('./router.js');
				router(Constants.fetch('STEP_JUST_READ_ALL_FROM_SERVER'));
			}, function (e) {
				lrException(e);
			});
	},


	getClassNameIds: function () {
		utilities.writeToScreen('Downloading id\'s', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_INFO'));

		var payload = [];
		for (var i = 0; i < LrClassNameConfig.fetch().length; i++) {
			payload.push('{"/classname/fetch-class-name-id": {"clazz": ' + LrClassNameConfig.fetch(i, 'clazz') + '}}');
		}

		return getData('[' + payload.join() + ']').then(
			function (e) {
				for (var i = 0; i < LrClassNameConfig.fetch().length; i++) {
					//classNameConfig[i].id = e[i];
					LrClassNameConfig.addToEntry(i, 'id', e[i]);
				}

				cache.saveToCache(LrClassNameConfig.fetch(), Constants.fetch('cacheClassNameConfig'));

			});

	},


	getUserSites: function() {
		utilities.writeToScreen('Downloading list of sites', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_INFO'));
		return getData('{"/group/get-user-sites": {}}').then(
			function (e) {
				if(e.length === 0) {
					throw Error('Could not find any sites');
				} else {

					// Dirty way of adding to global object.
					e.forEach(function(entry) {
//					    globalSites.push(entry);
						globalSites.add(entry);
					});

					globalCompanyId = e[0].companyId;
				}
			});
	},


	getCompanyGroup: function () {
	utilities.writeToScreen('Downloading company site', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_INFO'));
	return getData('{"/group/get-company-group": {"companyId": "' + globalCompanyId + '"}}').then(
		function (e) {
			// Dirty way of adding the global site to the list of sites.
			globalSites.setAll(JSON.parse('[' + JSON.stringify(globalSites.fetch()).substr(1).slice(0, -1) + ',' + JSON.stringify(e) + ']'));
			cache.saveToCache(globalSites.fetch(), Constants.fetch('cacheSitesFilename'));
		});
	},


	getStructures: function () {
		utilities.writeToScreen('Downloading structures', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_INFO'));

		var sitesList = [];
		var i;
		for (i = 0; i < globalSites.fetch().length; ++i) {
			sitesList.push(globalSites.fetch(i, 'groupId'));
		}

		return getData('{"/ddmstructure/get-structures": {"groupIds": [' + sitesList.join() + ']}}').then(
			function (e) {

				// Remove every entry (therer is only 1) with className
				// 'PortletDocumentlibraryUtilRawMetadataProcessor'.
				// This is a Liferay internal structure which is used to parse
				// document metadata and display it in the Document and Media Portlet.
				var idRawMetaDataProcessor = LrClassNameConfig.getSingleValue('clazz', 'com.liferay.portlet.documentlibrary.util.RawMetadataProcessor', 'id');
				e = e.filter(function(entry) {
					return entry.classNameId != idRawMetaDataProcessor;
				});

				// Check if there's a DDM we should ignore
				e = e.filter(function(entry) {
					if(_.contains(Config.fetch('ignoreDDMs'), entry.structureKey)) {
						return false;
					} else {
						return true;
					}
				});

				// Ugly way of copying all content to the global object with structures.
				e.forEach(function(entry) {
					globalStructures.add(entry);
				});

				cache.saveToCache(globalStructures.fetch(), Constants.fetch('cacheStructuresFilename'));

			});
	},


	getTemplates: function () {

		utilities.writeToScreen('Downloading templates', Constants.fetch('SEVERITY_NORMAL'), Constants.fetch('SCREEN_PRINT_INFO'));
		var payload = [];

		for (var i = 0; i < globalSites.fetch().length; ++i) {
			for (var ii = 0; ii < LrClassNameConfig.fetch().length; ii++) {
				if (LrClassNameConfig.fetch(ii, 'getTemplate')) {
					payload.push('{"/ddmtemplate/get-templates": {"groupId": ' + globalSites.fetch(i, 'groupId') + ', "classNameId": ' + LrClassNameConfig.fetch(ii, 'id') + '}}');
				}
			}
		}

		return getData('[' + payload.join() + ']').then(
			function (e) {
				var curTemplate = [];
				for (var y = 0; y < e.length; ++y) {
					for (i = 0; i < e[y].length; ++i) {

						// Check if there's a DDM we should ignore
						if(!_.contains(Config.fetch('ignoreDDMs'), e[y][i].templateKey)) {
//							globalTemplates.push(e[y][i]);
							globalTemplates.add(e[y][i])
						}
					}
				}
				cache.saveToCache(globalTemplates.fetch(), Constants.fetch('cacheTemplatesFilename'));

			});
	}



};

module.exports = download;