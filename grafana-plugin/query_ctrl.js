define([
  'angular',
  'lodash',
  'app/plugins/sdk'
],
function (angular, _, sdk) {
  'use strict';

  var PgmonQueryCtrl = (function(_super) {

    function PgmonQueryCtrl($scope, $injector, templateSrv, $q, uiSegmentSrv) {
      _super.call(this, $scope, $injector);
      this.q = $q;
      this.uiSegmentSrv = uiSegmentSrv;
      this.templateSrv = templateSrv;

      if (!this.target.aggregator) {
        this.target.aggregator = 'avg';
      }
      if (!this.target.period) {
        this.target.period = '300';
      }
      if (!this.target.dimensions) {
        this.target.dimensions = [];
      }
      if (!this.target.groups) {
        this.target.groups = [];
      }

      this.validateTarget();

      // Expose versions of functions which can be used from typeahead, as
      // they called without this, we provide versions with it pre-bound.
      this.suggestMetrics = this._doSuggestMetrics.bind(this);
      this.suggestDimensionKeys = this._doSuggestDimensionKeys.bind(this);
      this.suggestDimensionValues = this._doSuggestDimensionValues.bind(this);
    }

    PgmonQueryCtrl.prototype = Object.create(_super.prototype);
    PgmonQueryCtrl.prototype.constructor = PgmonQueryCtrl;

    PgmonQueryCtrl.templateUrl = 'partials/query.editor.html';

    PgmonQueryCtrl.prototype.targetBlur = function() {
      this.validateTarget();
      if (!_.isEqual(this.oldTarget, this.target) && _.isEmpty(this.target.error)) {
        this.oldTarget = angular.copy(this.target);
        this.refresh();
      }
    };

    PgmonQueryCtrl.prototype.validateTarget = function() {
      this.target.error = "";

      if (!this.target.repository) {
	this.target.error = "No repository specified";
      }

      if (this.target.repository == 'Metrics') {
	if (!this.target.metric) {
          this.target.error = "No metric specified";
	}
	if (!this.target.period) {
          this.target.error = "You must supply a period for obtaining Metrics";
	}
      }
      for (var i = 0; i < this.target.dimensions.length; i++) {
        if (!this.target.dimensions[i].key) {
          this.target.error = "One or more dimensions is missing a key";
          break;
        }
        if (!this.target.dimensions[i].value){
          this.target.error = "One or more dimensions is missing a value";
          break;
        }
      }
      if (this.target.error) {
        console.log(this.target.error);
      }
    };

    PgmonQueryCtrl.prototype._doSuggestMetrics = function(query, callback) {
      this.datasource.metricsNamesQuery().then(callback);
    };

    PgmonQueryCtrl.prototype._doSuggestDimensionKeys = function(query, callback) {
      var names = null;

      if (this.target.repository == 'Logs') {
	names = this.datasource.logsDimensionNamesQuery();
      }
      if (this.target.repository == 'Metrics' && this.target.metric) {
	names = this.datasource.metricsDimensionNamesQuery(this.target.metric);
      }

      if (names) {
	names.then(callback);
      }	
    };

    PgmonQueryCtrl.prototype._doSuggestDimensionValues = function(query, callback) {
      var values = null;
      
      if (this.currentDimension.key) {
	if (this.target.repository == 'Logs') {
	  values = this.datasource.logsDimensionValuesQuery(this.currentDimension.key);
	}
	if (this.target.repository == 'Metrics' && this.target.metric) {
	  values = this.datasource.metricsDimensionValuesQuery(this.target.metric, this.currentDimension.key);
	}
      }
      
      if (values) {
	var templates = this.datasource.templateSrv.variables.map(v => '$'+v.name);
	values
	  .then(values => templates.concat(values))
	  .then(callback);
      }
    };

    PgmonQueryCtrl.prototype.editDimension = function(index) {
      this.currentDimension = this.target.dimensions[index];
    };

    PgmonQueryCtrl.prototype.addDimension = function() {
      this.target.dimensions.push({});
    };

    PgmonQueryCtrl.prototype.removeDimension = function(index) {
      this.target.dimensions.splice(index, 1);
      this.targetBlur();
    };

    PgmonQueryCtrl.prototype.addGroup = function() {
      this.target.groups.push({});
    };

    PgmonQueryCtrl.prototype.removeGroup = function(index) {
      this.target.groups.splice(index, 1);
      this.targetBlur();
    };

    return PgmonQueryCtrl;

  })(sdk.QueryCtrl);

  return PgmonQueryCtrl;
});
