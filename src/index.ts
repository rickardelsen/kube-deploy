import { Elysia, t } from "elysia";
const deployURL = process.env.DEPLOYMENT_URL || "https://localhost:6443";
const serviceURL = process.env.SERVICE_URL || "https://localhost:6443";
const ingressURL = process.env.INGRESS_URL || "https://localhost:6443";
const token = process.env.KUBE_TOKEN || "-";

const app = new Elysia()
.get("/", () => {
  return { status: "ok"}
})
.post("/deploy", async ({query, set}) => {
  const request = { ...query }
  const deploy = {
    type: "apps.deployment",
    metadata: {
      namespace: "default",
      labels: {
        'workload.user.cattle.io/workloadselector': `apps.deployment-default-api-${request.nim}`
      },
      name: `api-${request.nim}`
    },
    spec: {
      replicas: 1,
      template: {
        spec: {
          restartPolicy: "Always",
          containers: [
            {
              imagePullPolicy: "Always",
              name: "container-0",
              securityContext: {
                runAsNonRoot: false,
                readOnlyRootFilesystem: false,
                privileged: false,
                allowPrivilegeEscalation: false
              },
              _init: false,
              volumeMounts: [],
              __active: true,
              image: `${request.docker_username}/api-${request.nim}:latest`,
              ports: [
                {
                  name: `serv-${request.nim}`,
                  expose: true,
                  protocol: "TCP",
                  containerPort: 8080,
                  hostPort: null,
                  hostIP: null,
                  _serviceType: "ClusterIP",
                  _ipam: "dhcp"
                }
              ],
              env: [
                {
                  name: "NIM",
                  value: `${request.nim}`
                },
                {
                  name: "NAMA",
                  value: `${request.nama}`
                }
              ],
              envFrom: []
            }
          ],
          initContainers: [],
          imagePullSecrets: [],
          volumes: [],
          affinity: {}
        },
        metadata: {
          labels: {
            'workload.user.cattle.io/workloadselector': `apps.deployment-default-api-${request.nim}`
          },
          namespace: "default"
        }
      },
      selector: {
        matchLabels: {
          'workload.user.cattle.io/workloadselector': `apps.deployment-default-api-${request.nim}`
        }
      }
    }
  }
  const sendDeploy = await fetch(deployURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(deploy)
  })
  const deployResponse = await sendDeploy.json()
  const uid = deployResponse.metadata.uid

  const service = {
    type: "service",
    spec: {
      ports: [
        {
          name: `serv-${request.nim}`,
          protocol: "TCP",
          port: 8080,
          targetPort: 8080
        }
      ],
      selector: {
        'workload.user.cattle.io/workloadselector': `apps.deployment-default-api-${request.nim}`
      },
      type: "ClusterIP"
    },
    metadata: {
      name: `api-${request.nim}`,
      namespace: "default",
      annotations: {
        'field.cattle.io/targetWorkloadIds': `[\"default/api-${request.nim}\"]`,
        'management.cattle.io/ui-managed': "true"
      },
      ownerReferences: [
        {
          apiVersion: "apps/v1",
          controller: true,
          kind: "Deployment",
          name: `api-${request.nim}`,
          uid: uid
        }
      ]
    }
  }
  const sendService = await fetch(serviceURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(service)
  })
  const serviceResponse = await sendService.json()

  const ingress = {
    type: "networking.k8s.io.ingress",
    metadata: {
      namespace: "default",
      name: `ing-${request.nim}`
    },
    spec: {
      rules: [
        {
          host: `${request.nim}.kartel.dev`,
          http: {
            paths: [
              {
                backend: {
                  service: {
                    port: {
                      number: 8080
                    },
                    name: `api-${request.nim}`
                  }
                },
                path: "/",
                pathType: "Prefix"
              }
            ]
          }
        }
      ],
      backend: {},
      tls: [
        {
          hosts: [
            `${request.nim}.kartel.dev`
          ],
          secretName: null
        }
      ]
    },
    cacheObject: {
      useNestedBackendField: true,
      showPathType: true
    }
  }
  const sendIngress = await fetch(ingressURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(ingress)
  })
  const ingressResponse = await sendIngress.json()
  const data = {
    deploy: deployResponse.status,
    service: serviceResponse.status,
    ingress: ingressResponse.status
  }
  set.status = 200
  return data
}, {
  query: t.Object({
    nim: t.String(),
    nama: t.String(),
    docker_username: t.String()
  })
})
.delete("/clean/:nim", async ({params, set}) => {
  const nim = params.nim
  const delIngress = await fetch(`${ingressURL}/default/ing-${nim}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  })
  const resDelIngress = await delIngress.json()
  const delService = await fetch(`${serviceURL}/api-${nim}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  })
  const resDelService = await delService.json()
  const delDeploy = await fetch(`${deployURL}/default/api-${nim}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  })
  const resDelDeploy = await delDeploy.json()
  const data = {
    deploy: resDelDeploy,
    service: resDelService,
    ingress: resDelIngress
  }
  set.status = 204
  return data
})

.listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
