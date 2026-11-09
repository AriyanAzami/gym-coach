-- health_runs_wake() is a trigger function; nobody should reach it over the API.
revoke execute on function health_runs_wake() from public, anon, authenticated;
