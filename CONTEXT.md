# Digger

Digger is a small mobile GUI for running DNS lookups and presenting the current response as either a polished structured view or `dig`-style text.

## Language

**Query**:
A DNS lookup defined by a name, record type, resolver, and optional query settings.
_Avoid_: Command

**Result**:
The response or error produced by the current query. Results are displayed and may be copied or shared, but are not saved in History.
_Avoid_: History entry, saved result

**Recent Query**:
The name and record type of a valid query the user ran, saved locally to refill the Query form. Entries are unique by name and record type, ordered by most recent use, limited to 50, and never contain a previous result.
_Avoid_: Saved result, result history
