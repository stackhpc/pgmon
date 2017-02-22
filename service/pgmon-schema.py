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
# pgmon-schema: Utility to deploy schemas for pgmon database.
#

import jinja2
import psycopg2

LOGS_ARGS = {
    'with_parsing': True,
    'with_rsyslog': True
}

METRICS_ARGS = {
    'with_summary': True,
    'summary_periods': [ 300 ],
    'with_collectd': True
}

def render_sql(name, context):
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader('./sql/schemas'),
        trim_blocks=True,
        lstrip_blocks=True
    )
    return env.get_template(name).render(context)

dsn = "dbname='pgmon'"

SCHEMA_EXISTS_SQL = """
SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = %(schema)s)
"""

def schema_exists(cursor, schema):
    cursor.execute(SCHEMA_EXISTS_SQL, { 'schema': schema })
    return bool(cursor.fetchall()[0][0])

def schema_create(conn, schema, sql_template, args):

    # Do everything in a transaction to rollback on an exception.
    with conn.cursor() as cursor:
    
        if schema_exists(cursor, schema):
            print("{}: Schema already exists - skipping".format(schema))
            return

        cursor.execute("CREATE SCHEMA {}".format(schema))
            
        sql = render_sql(sql_template, args)
        print(sql)

        cursor.execute(sql)
        conn.commit()

        print("{}: Schema created".format(schema))

with psycopg2.connect(dsn) as conn:
    schema_create(conn, 'logs', 'logs.sql.j2', LOGS_ARGS)
    schema_create(conn, 'metrics', 'metrics.sql.j2', METRICS_ARGS)
