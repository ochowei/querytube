# QueryTube Domain Language

This glossary defines QueryTube's canonical product terms. Use these terms consistently in OpenSpec artifacts and repository documentation.

## Search definitions

**YAML Search Definition**:
A structured definition of one or more searches, expressed as YAML and made up of individual queries with optional shared defaults.

**Query**:
One search instruction within a YAML Search Definition, with its own search text and optional search settings.

**Query Set**:
A named, reusable YAML Search Definition saved by a user. A search can also run from unsaved YAML without a Query Set.
_Avoid_: saved search, query template

## Execution and history

**Search Request**:
A request to execute a YAML Search Definition, whether it comes from a saved Query Set or unsaved YAML.

**Search Run**:
A record of one invocation of a Search Request, whether or not it is associated with a Query Set.

**Query Outcome**:
The outcome of executing one Query: success with zero or more Video Results, or failure.

**Search Result**:
The request-level output of a Search Request, made up of its Query Outcomes and a summary.
_Avoid_: Query Result

**Query Result**:
The Search History record of one Query Outcome within a Search Run, including its Video Results or failure information.

**Video Result**:
A YouTube video returned for a Query and included in that Query's outcome.

**Video Statistics Snapshot**:
The YouTube counts observed for a Video Result during one Search Run, together with their observation time. They are historical facts of that run, independent of later changes on YouTube.

**Output YAML**:
A normalized YAML representation reconstructed from a Search Run and its Query Results.

**Owner**:
The user who owns a Query Set or Search Run and can manage its lifecycle and sharing settings.

## Sharing

**Query Set publication**:
The owner's choice to make a Query Set available to anonymous readers through the public read API.

**Search Run visibility**:
The owner's private or public choice for a Search Run. It is independent of the publication state or continued existence of an associated Query Set.

**Public Query Set**:
A Query Set whose owner has enabled anonymous read access through the public read API.

**Public Search Run**:
A Search Run whose own visibility is public, whether or not its associated Query Set still exists or is public.

**Public Read API**:
The anonymous, read-only interface for retrieving Query Sets and Search Runs that their owners have made public.
