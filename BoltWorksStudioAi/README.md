# BoltWorksStudioAi

Detta är den separata, kanoniska handboken för AI-system som ska skapa och
granska redigerbara modeller för BoltWorks 3D AI Studio.

Målet är inte bara att producera JSON som går att importera. Målet är att en AI
ska kunna:

1. läsa det verkliga projektformatet;
2. planera modellen som namngivna delar och grupper;
3. skapa en komplett `.modelerproj` med korrekta transformationer och texturer;
4. ladda projektet i den riktiga studion;
5. skapa ett sexvys-ark med **QA Sheet**;
6. granska bilden och korrigera synliga fel innan arbetet kallas klart.

## Läsordning för en AI

1. [`AI_AUTHORING_PROTOCOL.md`](AI_AUTHORING_PROTOCOL.md) – obligatoriskt arbetsflöde.
2. [`PROJECT_FORMAT.md`](PROJECT_FORMAT.md) – exakt projektstruktur och fält.
3. [`SHAPE_CATALOG.md`](SHAPE_CATALOG.md) – formernas lokala axlar och geometri.
4. [`TEXTURE_WORKFLOW.md`](TEXTURE_WORKFLOW.md) – skapa, bädda in och kontrollera materialbilder.
5. [`VISUAL_QA.md`](VISUAL_QA.md) – hur modellen måste renderas och granskas.
6. [`STUDIO_FEATURES.md`](STUDIO_FEATURES.md) – current editor tools, tile export and UV workflows.
7. [`SYSTEM_PROMPT.md`](SYSTEM_PROMPT.md) – färdig grundinstruktion för en skapande AI.
8. [`schemas/modeler-project.schema.json`](schemas/modeler-project.schema.json) – maskinläsbart schema.
9. [`examples/minimal-valid.modelerproj`](examples/minimal-valid.modelerproj) – litet fungerande exempel.

## AI work sessions

[`AI_WORK_SESSIONS.md`](AI_WORK_SESSIONS.md) defines bounded AI work sessions,
the Human AI Viewer event stream, and the optional `.bws-session.json` sidecar.
Its machine-readable contract is
[`schemas/ai-work-session.schema.json`](schemas/ai-work-session.schema.json).
Session notes record concise, observable workflow facts and results; they must
never request or store hidden reasoning, private chain-of-thought, credentials,
or a full scene snapshot for every event.

## Verktyg

Inspektera och validera ett projekt utan att öppna studion:

```text
node BoltWorksStudioAi/tools/inspect-project.mjs path/to/model.modelerproj
```

Skriv en kompakt maskinläsbar rapport:

```text
node BoltWorksStudioAi/tools/inspect-project.mjs path/to/model.modelerproj --json
```

Verktyget hittar bland annat dubbla ID:n, okända former, trasiga grupper,
saknade texturer och ogiltiga transformationer. Det ersätter inte visuell QA.

## Stilbibliotek

For recurring building types, the AI must also read the matching style library
before authoring begins. The first canonical library is
[`libraries/medieval-house/README.md`](libraries/medieval-house/README.md),
covering Blackstone components, materials, transparent windows, interior roof
trusses, camera directors, and rules for coherent but varied villages.

## Viktig princip

JSON-validering kan visa att en fil är tekniskt korrekt. Endast rendering kan
visa att tak, Wedges, fönster, hjul och andra riktade delar faktiskt är vända
och placerade rätt. En AI får därför aldrig skriva "klart" eller "fixat" innan
den har granskat ett nytt QA Sheet skapat från den senaste projektfilen.

## Keeping the handbook current

Whenever the studio gains or changes a user-visible tool, exporter, camera
rule, transform behavior, texture/UV workflow, or project field, update the
matching handbook document in the same change. Add practical usage details to
`STUDIO_FEATURES.md`; update the format contract, shape catalogue, texture
workflow, schema, or QA guide when that specific contract changed.
