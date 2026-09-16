o job keep alive nao está funcionando pro ambiente de dev desde 2026-08-11 baseado no que vejo no banco de dados de dev. prod tem funcionando normalmente eu preciso que ambos os ambientes voltem a funcionar normalmente, eu nao sei tem relação com algum dos commits feitos no passado pq isso funcionava bem antes.

aqui tem o log da function extraído do vercel:
---
2026-08-23 21:55:50.906 [info] [keepalive] run started
2026-08-23 21:55:50.909 [info] [keepalive] starting meufenil
2026-08-23 21:55:51.801 [info] [keepalive] ok meufenil after 895ms
2026-08-23 21:55:52.078 [info] [keepalive] run finished in 1174ms with success
---

aqui tem o log da chamada tbm extraída do vercel
---
# GET /api/keepalive

Status: 200

## Request

Started: Aug 23 18:55:50.25 GMT-3

Request ID: nxrk9-1787522150255-f398f7991cb5

Path: /api/keepalive

Host: meufenil-rmblntmez-lucas-martins-menezes-projects.vercel.app

User Agent: vercel-cron/1.0

Received in Washington, D.C., USA (iad1)

### Firewall

Allowed

### Function Invocation

Route: /api/keepalive

Execution Duration: 1.47s

### External APIs

**External APIs**

| Method | Request |
| - | - |
| GET |  |
| POST |  |

### Fluid

205 MB

Response finished in 1.8s

## Deployment Information
Deployment ID: dpl_GXAQqymGJVLpqc4mfvxWjKwMBCrm
Environment: production
Branch: master
---

aqui tem um log em formato json tbm extraído do vercel:
---
[
    {
        "projectId": "prj_j82W6EhOiJJJZvJYAkToNYFaSAjA",
        "TimeUTC": "2026-08-23 21:55:50",
        "timestampInMs": 1787522150906,
        "requestPath": "meufenil-rmblntmez-lucas-martins-menezes-projects.vercel.app/api/keepalive",
        "requestMethod": "GET",
        "requestQueryString": "",
        "responseStatusCode": 200,
        "requestId": "nxrk9-1787522150255-f398f7991cb5",
        "requestUserAgent": "vercel-cron/1.0",
        "environment": "production",
        "branch": "master",
        "vercelCache": "MISS",
        "host": "meufenil-rmblntmez-lucas-martins-menezes-projects.vercel.app",
        "deploymentDomain": "meufenil-rmblntmez-lucas-martins-menezes-projects.vercel.app",
        "deploymentId": "dpl_GXAQqymGJVLpqc4mfvxWjKwMBCrm",
        "traceId": "",
        "sessionId": "",
        "type": "function",
        "function": "/api/keepalive",
        "level": "info",
        "message": "[keepalive] run started",
        "durationMs": "",
        "region": "",
        "maxMemoryUsed": "",
        "memorySize": "",
        "invocationId": "",
        "instanceId": "",
        "concurrency": ""
    },
    {
        "projectId": "prj_j82W6EhOiJJJZvJYAkToNYFaSAjA",
        "TimeUTC": "2026-08-23 21:55:50",
        "timestampInMs": 1787522150909,
        "requestPath": "meufenil-rmblntmez-lucas-martins-menezes-projects.vercel.app/api/keepalive",
        "requestMethod": "GET",
        "requestQueryString": "",
        "responseStatusCode": 200,
        "requestId": "nxrk9-1787522150255-f398f7991cb5",
        "requestUserAgent": "vercel-cron/1.0",
        "environment": "production",
        "branch": "master",
        "vercelCache": "MISS",
        "host": "meufenil-rmblntmez-lucas-martins-menezes-projects.vercel.app",
        "deploymentDomain": "meufenil-rmblntmez-lucas-martins-menezes-projects.vercel.app",
        "deploymentId": "dpl_GXAQqymGJVLpqc4mfvxWjKwMBCrm",
        "traceId": "",
        "sessionId": "",
        "type": "function",
        "function": "/api/keepalive",
        "level": "info",
        "message": "[keepalive] starting meufenil",
        "durationMs": "",
        "region": "",
        "maxMemoryUsed": "",
        "memorySize": "",
        "invocationId": "",
        "instanceId": "",
        "concurrency": ""
    },
    {
        "projectId": "prj_j82W6EhOiJJJZvJYAkToNYFaSAjA",
        "TimeUTC": "2026-08-23 21:55:51",
        "timestampInMs": 1787522151801,
        "requestPath": "meufenil-rmblntmez-lucas-martins-menezes-projects.vercel.app/api/keepalive",
        "requestMethod": "GET",
        "requestQueryString": "",
        "responseStatusCode": 200,
        "requestId": "nxrk9-1787522150255-f398f7991cb5",
        "requestUserAgent": "vercel-cron/1.0",
        "environment": "production",
        "branch": "master",
        "vercelCache": "MISS",
        "host": "meufenil-rmblntmez-lucas-martins-menezes-projects.vercel.app",
        "deploymentDomain": "meufenil-rmblntmez-lucas-martins-menezes-projects.vercel.app",
        "deploymentId": "dpl_GXAQqymGJVLpqc4mfvxWjKwMBCrm",
        "traceId": "",
        "sessionId": "",
        "type": "function",
        "function": "/api/keepalive",
        "level": "info",
        "message": "[keepalive] ok meufenil after 895ms",
        "durationMs": "",
        "region": "",
        "maxMemoryUsed": "",
        "memorySize": "",
        "invocationId": "",
        "instanceId": "",
        "concurrency": ""
    },
    {
        "projectId": "prj_j82W6EhOiJJJZvJYAkToNYFaSAjA",
        "TimeUTC": "2026-08-23 21:55:52",
        "timestampInMs": 1787522152078,
        "requestPath": "meufenil-rmblntmez-lucas-martins-menezes-projects.vercel.app/api/keepalive",
        "requestMethod": "GET",
        "requestQueryString": "",
        "responseStatusCode": 200,
        "requestId": "nxrk9-1787522150255-f398f7991cb5",
        "requestUserAgent": "vercel-cron/1.0",
        "environment": "production",
        "branch": "master",
        "vercelCache": "MISS",
        "host": "meufenil-rmblntmez-lucas-martins-menezes-projects.vercel.app",
        "deploymentDomain": "meufenil-rmblntmez-lucas-martins-menezes-projects.vercel.app",
        "deploymentId": "dpl_GXAQqymGJVLpqc4mfvxWjKwMBCrm",
        "traceId": "",
        "sessionId": "",
        "type": "function",
        "function": "/api/keepalive",
        "level": "info",
        "message": "[keepalive] run finished in 1174ms with success",
        "durationMs": "",
        "region": "",
        "maxMemoryUsed": "",
        "memorySize": "",
        "invocationId": "",
        "instanceId": "",
        "concurrency": ""
    },
    {
        "projectId": "prj_j82W6EhOiJJJZvJYAkToNYFaSAjA",
        "TimeUTC": "2026-08-23 21:55:50",
        "timestampInMs": 1787522150255,
        "requestPath": "meufenil-rmblntmez-lucas-martins-menezes-projects.vercel.app/api/keepalive",
        "requestMethod": "GET",
        "requestQueryString": "",
        "responseStatusCode": 200,
        "requestId": "nxrk9-1787522150255-f398f7991cb5",
        "requestUserAgent": "vercel-cron/1.0",
        "environment": "production",
        "branch": "master",
        "vercelCache": "MISS",
        "host": "meufenil-rmblntmez-lucas-martins-menezes-projects.vercel.app",
        "deploymentDomain": "meufenil-rmblntmez-lucas-martins-menezes-projects.vercel.app",
        "deploymentId": "dpl_GXAQqymGJVLpqc4mfvxWjKwMBCrm",
        "traceId": "",
        "sessionId": "",
        "type": "function",
        "function": "/api/keepalive",
        "level": "",
        "message": "",
        "durationMs": 1478,
        "region": "iad1",
        "maxMemoryUsed": 205,
        "memorySize": 2048,
        "invocationId": "01M0R9YVWEY0RK8NNF0SRWAKAT",
        "instanceId": "i1EqrvtyBXdc",
        "concurrency": 1
    }
]
---
