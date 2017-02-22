define([
  './datasource',
  './query_ctrl'
],
function(PgmonDatasource, PgmonQueryCtrl) {
  'use strict';

  var PgmonConfigCtrl = function() {};
  PgmonConfigCtrl.templateUrl = "partials/config.html";

  var PgmonQueryOptionsCtrl = function() {};
  PgmonQueryOptionsCtrl.templateUrl = "partials/query.options.html";

  return {
    'Datasource': PgmonDatasource,
    'QueryCtrl': PgmonQueryCtrl,
    'ConfigCtrl': PgmonConfigCtrl,
    'QueryOptionsCtrl': PgmonQueryOptionsCtrl
  };
});
