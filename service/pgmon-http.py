#
# Copyright 2017 StackHPC Ltd
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

#
# pgmon-http: Minimal HTTP API for querying metrics and logs
#
# Very basic HTTP API which performs Jinja2 templated SQL queries and returns
# the response as JSON. The use of templated queries is primarily to make
# prototyping easier, and might not be the best approach otherwide. Care has
# been taken to substitute request parameters in the SQL directly.
#
# An example response from an API might look like this:
#
#     [
#         "columns": [ "timestamp", "message", "dimensions" ],
#         "rows": [
#             [ "2015-01-01 01:10:00", "Messages", { "hostname": "host-01" } ],
#             [ "2015-01-01 01:15:00", "Moo", { "hostname": "host-02" } ],
#         ]
#     ]
#

from aiohttp import web
import aiopg
import datetime
import jinja2
import json

dsn = "dbname='pgmon'"

class ISODateEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return obj.isoformat()
        return json.ISODateEncoder.default(self, obj)

def render_sql(name, context):
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader('./sql/queries/'),
        trim_blocks=True,
        lstrip_blocks=True
    )
    return env.get_template(name).render(context)

async def execute(sql_template, args):
    sql = render_sql(sql_template, args)
    print(sql)
    print(args)
    async with aiopg.connect(dsn) as conn:
        async with conn.cursor() as cursor:
            await cursor.execute(sql, args)
            columns = [ d.name for d in cursor.description ]
            data = { 'columns': columns, 'rows': await cursor.fetchall() }
            dumps = lambda data: json.dumps(data, cls=ISODateEncoder)
            return web.json_response(data, dumps=dumps)

def list_arg(x):
    return x.split(',')

def dict_arg(x):
    args = [ tuple(kv.split(':')) for kv in x.split(',') ]
    return json.dumps({ k: v for k, v in args if v != '*'})

def parse(request, argument, parser = lambda x: x):
    value = request.rel_url.query.get(argument, None)
    return (argument, None if value is None else parser(value))
    
async def handle_statistics(r):
    args = dict([
        parse(r, 'start_time'),
        parse(r, 'end_time'),
        parse(r, 'period', int),
        parse(r, 'metric_name'),
        parse(r, 'dimensions', dict_arg),
        parse(r, 'group_by', list_arg),
        parse(r, 'statistics', list_arg)
    ])

    return await execute('metrics_statistics.sql.j2', args)

async def handle_metric_names(r):
    args = dict([
        parse(r, 'dimensions', dict_arg)
    ])

    return await execute('metrics_names.sql.j2', args)

async def handle_dimension_names(r):
    args = dict([
        parse(r, 'metric_name')
    ])

    return await execute('metrics_dimension_names.sql.j2', args)
    
async def handle_dimension_values(r):
    args = dict([
        parse(r, 'metric_name'),
        parse(r, 'dimension_name')
    ])
    
    return await execute('metrics_dimension_values.sql.j2', args)

async def handle_logs_list(r):
    args = dict([
        parse(r, 'start_time'),
        parse(r, 'end_time'),
        parse(r, 'dimensions', dict_arg),
        parse(r, 'limit', int)
    ])

    return await execute('logs_list.sql.j2', args)

async def handle_logs_dimension_names(r):
    args = dict([
    ])

    return await execute('logs_dimension_names.sql.j2', args)

async def handle_logs_dimension_values(r):
    args = dict([
        parse(r, 'dimension_name')
    ])

    return await execute('logs_dimension_values.sql.j2', args)

app = web.Application()

app.router.add_get('/metrics/statistics', handle_statistics)
app.router.add_get('/metrics/names', handle_metric_names)
app.router.add_get('/metrics/dimension_names', handle_dimension_names)
app.router.add_get('/metrics/dimension_values', handle_dimension_values)

app.router.add_get('/logs/list', handle_logs_list)
app.router.add_get('/logs/dimension_names', handle_logs_dimension_names)
app.router.add_get('/logs/dimension_values', handle_logs_dimension_values)

web.run_app(app)
