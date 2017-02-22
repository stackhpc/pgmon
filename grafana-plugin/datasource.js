define([
  'angular',
  'lodash',
  'moment',
  'app/plugins/sdk',
  'app/core/utils/datemath',
  'app/core/utils/kbn',
  './query_ctrl',
],
function (angular, _, moment, sdk, dateMath, kbn) {
  'use strict';

  /*
   * Public Methods: Called by Grafana.
   */
  
  // Initialise the datasource.
  function PgmonDatasource(instanceSettings, $q, backendSrv, templateSrv) {
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.templateSrv = templateSrv;
  }

  // Obtain possible values for a template variable.
  PgmonDatasource.prototype.metricFindQuery = function(query) {
    var [type, dimension] = query.split(':');
    return this._request('/' + type + '/dimension_values',
			 { 'dimension_name': dimension },
			 _convertListData)
      .then(data => _.map(data, value => { return { text: value } }));
  };

  // Test the datasource configuration.
  PgmonDatasource.prototype.testDatasource = function() {
    return this.metricsNamesQuery().then(function () {
      return { status: 'success', message: 'Data source is working', title: 'Success' };
    });
  };

  // Perform a query on the datasource with the given options.
  PgmonDatasource.prototype.query = function(options) {
    var from = _translateTime(options.range.from);
    var to = _translateTime(options.range.to);

    var promises = options.targets
	.filter(t => !t.error && !t.hide && t.repository)
	.map(target => {
	  
	  var query = _buildQuery(target, from, to);
	  
	  query = this.templateSrv.replace(query, options.scopedVars);
	  query = _convertPeriod(query);
	  var queries = _expandTemplatedQueries(query);

	  if (target.repository == 'Logs') {
	    return queries.map(q => this._logsQuery(q));
	  }
	  if (target.repository == 'Metrics') {
	    return queries.map(q => this._metricsQuery(target, q));
	  }
	});

    return this.q.all(_.flatten(promises)).then(results => {
      return { data: _.flatten(results).filter(r => !_.isEmpty(r)) };
    });
  };

  /*
   * Public Methods: Called by Query Editor.
   */

  // Query the list of metric names.
  PgmonDatasource.prototype.metricsNamesQuery = function() {
    return this._request('/metrics/names',
			 {},
			 _convertListData);
  };

  // Query the list of dimension names for a particular metric.
  PgmonDatasource.prototype.metricsDimensionNamesQuery = function(metric) {
    return this._request('/metrics/dimension_names',
			 {'metric_name' : metric },
			 _convertListData);
  };

  // Query the list of values for a particular dimension within a metric.
  PgmonDatasource.prototype.metricsDimensionValuesQuery = function(metric, dimension) {
    return this._request('/metrics/dimension_values',
			 { 'metric_name' : metric, 'dimension_name': dimension},
			 _convertListData);
  };

  // Query the list of dimension names recorded against log entries.
  PgmonDatasource.prototype.logsDimensionNamesQuery = function() {
    return this._request('/logs/dimension_names',
			 {},
			 _convertListData);
  };

  // Query the list of values for a particular log dimension.
  PgmonDatasource.prototype.logsDimensionValuesQuery = function(dimension) {
    return this._request('/logs/dimension_values',
			 {'dimension_name': dimension},
			 _convertListData);
  };

  /*
   * Private Methods
   */

  // Perform a metrics query and convert to raw documents suitable for Grafana.
  PgmonDatasource.prototype._logsQuery = function(query) {
    return this._request('/logs/list?' + query,
			 {},
			 _convertLogsData);
  };

  // Perform a metrics query and convert to datapoints suitable for Grafana.
  PgmonDatasource.prototype._metricsQuery = function(target, query) {
    return this._request('/metrics/statistics?' + query,
			 {},
			 data => _convertMetricsData(target, data));
  };

  // Perform a request to the datasource backend.
  PgmonDatasource.prototype._request = function(path, params, convert) {
    var headers = {
      'Content-Type': 'application/json',
    };

    var options = {
      method: 'GET',
      url: this.url + path,
      params: params,
      headers: headers,
      withCredentials: true,
    };

    return this.backendSrv.datasourceRequest(options)
      .then(response => convert(response.data))
      .catch(function(err) {throw err;})
  };

  /*
   * Private Functions
   */

  function _convertPeriod(target) {
    var regex = target.match(/period=[^&]*/);
    if (regex) {
      var period = regex[0].substring('period='.length);
      var matches = period.match(kbn.interval_regex);
      if (matches) {
        period = kbn.interval_to_seconds(period);
        target = target.replace(regex, 'period='+period);
      }
    }
    return target;
  }
  
  function _dimensionsQueryParam(options) {
    return options.dimensions
      .filter(d => d.value != '*')
      .map(d => d.key + ':' + d.value)
      .join(',');
  }

  function _groupsQueryParam(options) {
    return options.groups
      .map(g => g.key)
      .join(',');
  }

  function _metricQueryParams(options) {
    return {
      metric_name: options.metric,
      dimensions: _dimensionsQueryParam(options),
      group_by: _groupsQueryParam(options),
      statistics: options.aggregator,
      period: options.period
    };
  }

  function _logQueryParams(options) {
    return {
      dimensions: _dimensionsQueryParam(options)
    };
  }
  
  function _buildQuery(options, from, to) {
    var params = {
      start_time: from,
      end_time: to
    };
    
    if (options.repository == 'Metrics') {
      _.extend(params, _metricQueryParams(options));      
    }
    if (options.repository == 'Logs') {
      _.extend(params, _logQueryParams(options));
    }
    
    return Object.keys(params)
      .filter(key => params[key])
      .map(key => key + '=' + params[key])
      .join('&');
  };

  function _expandTemplatedQueries(query) {
    var templated_vars = query.match(/{[^}]*}/g);
    if (!templated_vars) {
      return [query];
    }

    var expandedQueries = [];
    var to_replace = templated_vars[0];
    var var_options = to_replace.substring(1, to_replace.length - 1);
    var_options = var_options.split(',');
    for (var i = 0; i < var_options.length; i++) {
      var new_query = query.split(to_replace).join(var_options[i]);
      expandedQueries = expandedQueries.concat(_expandTemplatedQueries(new_query));
    }
    return expandedQueries;
  };

  function _convertListData(data) {
    return data.rows.map(_.first);
  };  
  
  function _convertMetricsData(target, data) {
    var columns = _columnsExtractor(data.columns);
    var series = _preSortedGroupBy(data.rows, columns(['dimensions']));

    return _.map(series, ([key, rows]) => {
      var target_name = key.join(' ') || target.metric;
      
      var datapoints = rows
	  .map(columns([target.aggregator, 'timestamp']))
	  .map(row => [ row[0], (new Date(row[1])).getTime() ]);
      
      return { 'target': target_name, 'datapoints': datapoints };
    });
  };

  function _convertLogsData(data) {
    var docs = data.rows.map(row => _.fromPairs(_.zip(data.columns, row)));
    return [ { 'target': 'docs', 'type': 'docs', 'datapoints': docs } ];
  };

  function _preSortedGroupBy(list, getkey) {
    return list.reduce((result, entry) => {
      var key = getkey(entry);
      var last = result[result.length - 1];

      if (last && _.isEqual(last[0], key)) {
	last[1].push(entry);
	result[result.length - 1] = last;
      }
      else {
	result.push([ key, [ entry ] ]);
      }
      return result;
    }, []);
  };

  function _columnsExtractor(columns_spec) {
    var indices_lookup = columns_spec
	.reduce((out, value, index) => { out[value] = index; return out; }, {});
    
    return function(columns) {
      var indices = columns.map(name => indices_lookup[name]);
      return function(row) {
	return indices.map(index => row[index]);
      };
    };
  };

  function _translateTime(date) {
    if (date === 'now') {
      return null;
    }
    return moment.utc(dateMath.parse(date).valueOf()).toISOString();
  };
  
  return PgmonDatasource;
});
