# 002: Rails serializers

Status: provisional. Taken from the default in the build brief, without a council run. I confirm or overturn it on the Phase 0 pull request.

## Context

Rails returns JSON for every enforcement action. The job description asks for someone "comfortable reading and changing API controllers, serializers and model methods". Rails is new to me, and I must be able to explain every line.

## Options

- **A.** Plain Ruby objects. One class per resource with an `as_json` method that lists each field.
- **B.** A serializer gem, such as `jsonapi-serializer` or `alba`.
- **C.** Calling `to_json` on the model, or `render json: model`.

## Why no council

The brief names a default and gives the reason. The clock forced a cut from four council runs to two, and this decision has the least at stake: a serializer here is a dozen lines, and swapping the approach later touches only those files.

## Decision

Option A.

- A gem brings its own small language for declaring fields. That is one more thing to learn and one more thing hidden.
- Option C sends every column, so a new column becomes public the moment it is migrated. For a table holding PII, the field list must be written down.
- A plain object shows exactly which fields leave the service.

## Consequences

- Each serializer lists its fields by hand. Adding a field to a response is a deliberate edit.
- No sparse field sets, no includes, no pagination helpers. The app needs none of them.
- The shape each serializer produces is pinned by a fixture in `packages/shared/fixtures`, which the Jest tests and the Rails tests both read.
