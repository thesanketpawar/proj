<<<<<<< HEAD
=======
# Three-Tier DevOps Project — Complete Guide

A production-style **3-tier application** (React frontend → Node.js/Express backend → MySQL database) deployed on a **self-managed Kubernetes cluster on AWS EC2**, provisioned with **Terraform**, built and shipped through a **Jenkins multibranch CI/CD pipeline** with **SonarQube** code quality gates, and monitored with **Prometheus + Grafana**.

This is designed to be a portfolio project you can fully explain in a DevOps interview — every file has comments explaining *why*, not just *what*.

---

## 1. Architecture Overview

```
                                   ┌─────────────────────────────┐
                                   │        GitHub Repo          │
                                   │  main | dev | test branches │
                                   └──────────────┬───────────────┘
                                                  │ webhook push
                                                  ▼
                          ┌───────────────────────────────────────┐
                          │      EC2 #1: Jenkins + SonarQube        │
                          │  Docker build → SonarQube scan →        │
                          │  Trivy scan → push to DockerHub →       │
                          │  kubectl apply/rollout                  │
                          └───────────────────┬─────────────────────┘
                                              │ kubectl (kubeconfig)
                                              ▼
        ┌───────────────────────────────────────────────────────────────┐
        │                     Kubernetes Cluster (kubeadm)                │
        │  ┌─────────────────────┐        ┌───────────────────────────┐  │
        │  │ EC2 #2: Control      │        │ EC2 #3: Worker Node        │  │
        │  │ Plane (Master)       │◄──────►│ (Frontend/Backend/MySQL    │  │
        │  │ - kube-apiserver     │  join  │  pods actually run here)   │  │
        │  │ - etcd               │        │ - kubelet                 │  │
        │  │ - scheduler          │        │ - kube-proxy               │  │
        │  │ - controller-manager │        │ - containerd                │  │
        │  └─────────────────────┘        └───────────────────────────┘  │
        └───────────────────────────────────────────────────────────────┘
                                              │
                                    NodePort / Ingress
                                              ▼
                                      End user's browser
```

**Three tiers:**
| Tier | Technology | K8s objects |
|---|---|---|
| Frontend | React + nginx | `frontend-deployment`, `frontend-service`, `frontend-configmap` |
| Backend | Node.js + Express | `backend-deployment` (+HPA), `backend-service`, `backend-configmap` |
| Database | MySQL 8 | `mysql-deployment`, `mysql-service`, `mysql-pv`, `mysql-pvc`, `mysql-secret` |

---

## 2. Project Structure

```
three-tier-devops/
├── src/
│   ├── frontend/        # React app + Dockerfile + nginx.conf
│   ├── backend/         # Express API + Dockerfile
│   └── database/        # init.sql + Dockerfile
├── k8s/                 # All 14 Kubernetes manifests
├── terraform/           # AWS infra as code (VPC, EC2 x3, SGs)
├── scripts/             # EC2 userdata bootstrap scripts
├── monitoring/           # Prometheus + Grafana manifests
├── sonarqube/            # sonar-project.properties + setup notes
├── Jenkinsfile           # Multibranch CI/CD pipeline
├── docker-compose.yml    # Local testing (before touching K8s)
└── .gitignore
```

---

## 3. Local Development First (sanity check before AWS)

Test everything works on your machine before spending AWS money:

```bash
cp src/frontend/.env.example src/frontend/.env
cp src/backend/.env.example src/backend/.env
cp src/database/.env.example src/database/.env

docker-compose up --build
# Frontend: http://localhost:3000
# Backend:  http://localhost:5000/api/employees
```

---

## 4. AWS Infrastructure with Terraform

> ⚠️ **Everything below runs on AWS EC2 (Ubuntu). No WSL needed** — you only write/edit code locally (or in WSL) and `git push`; all execution happens on EC2 over SSH.

### Step 1 — Generate an SSH key pair for EC2 access
```bash
cd terraform
ssh-keygen -t rsa -b 4096 -f three-tier-devops-key -N ""
# creates three-tier-devops-key (private) and three-tier-devops-key.pub (public)
chmod 400 three-tier-devops-key
```

### Step 2 — Configure variables
```bash
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars: set my_ip = "$(curl -s ifconfig.me)/32"
```

### Step 3 — Provision AWS infrastructure
```bash
terraform init
terraform plan
terraform apply     # type 'yes'
```

This creates:
- 1 VPC + public subnet + Internet Gateway + route table
- 2 Security Groups (K8s nodes, Jenkins/Sonar)
- **EC2 #1** — Kubernetes **Control Plane** (auto-runs `kubeadm init` + installs Flannel CNI)
- **EC2 #2** — Kubernetes **Worker Node** (container runtime + kubeadm installed, NOT yet joined)
- **EC2 #3** — **Jenkins + SonarQube** server (Docker, Jenkins, SonarQube container, kubectl, Trivy)

Terraform prints the 3 public IPs at the end (`terraform output`).

---

## 5. What Runs Where — Control Plane vs Worker Node vs Jenkins

This is the #1 thing interviewers ask — know this cold:

### Control Plane (Master) — the "brain"
Runs the components that make cluster-wide decisions but **never runs your application pods** (by default, it's tainted `NoSchedule`):
- `kube-apiserver` — front door; every `kubectl` command talks to this
- `etcd` — the cluster's database (stores all object state: Deployments, Services, Secrets etc.)
- `kube-scheduler` — decides *which node* a new pod should run on
- `kube-controller-manager` — runs control loops (e.g. "Deployment says 2 replicas, only 1 exists → create one")

### Worker Node — the "muscle"
This is where your **frontend, backend, and MySQL pods actually run**:
- `kubelet` — the agent that talks to the control plane and starts/stops containers
- `kube-proxy` — programs iptables rules so Services can route traffic to the right pod
- `containerd` — the actual container runtime (pulls images, runs containers)

### Joining the worker to the cluster (manual step — do this yourself so you can explain it)
```bash
# 1. SSH into the control plane node
ssh -i three-tier-devops-key.pem ubuntu@<master-public-ip>
sudo cat /root/join-command.sh
# copy the full "kubeadm join ..." command shown

# 2. SSH into the worker node
ssh -i three-tier-devops-key.pem ubuntu@<worker-public-ip>
sudo kubeadm join <master-ip>:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>

# 3. Back on the master, verify:
kubectl get nodes
# Should show master (Ready) + worker (Ready)
```

### Jenkins Server — the "CI/CD engine" (separate EC2, NOT part of the K8s cluster)
This EC2 does **not** run Kubernetes at all. It only:
1. Listens for GitHub webhook pushes
2. Checks out code, runs unit tests
3. Runs SonarQube scan (SonarQube itself runs here too, as a Docker container on port 9000)
4. Builds Docker images (needs Docker installed — that's why we installed it here)
5. Scans images with Trivy
6. Pushes images to DockerHub
7. Uses `kubectl` (with a copied `kubeconfig` from the master) to remotely tell the K8s
   cluster "here's a new image, roll it out" — Jenkins itself never runs the app pods.

**Why 3 separate EC2 instances instead of 1?** — Separation of concerns + blast radius.
If Jenkins crashes, your live app on K8s keeps running. If the control plane restarts,
Jenkins builds aren't affected. This mirrors real company setups (CI/CD infra is usually
separate from the runtime cluster, e.g. Jenkins EC2/on-prem vs an EKS cluster).

---

## 6. Deploy the Application to Kubernetes (manual first run)

```bash
ssh -i three-tier-devops-key.pem ubuntu@<master-public-ip>

git clone <your-repo-url>
cd three-tier-devops/k8s

kubectl apply -f namespace.yml
kubectl apply -f secret.yml
kubectl apply -f configmap.yml
kubectl apply -f backend-configmap.yml
kubectl apply -f frontend-configmap.yml

# Database first (frontend/backend depend on it being reachable)
kubectl apply -f mysql-pv.yml
kubectl apply -f mysql-pvc.yml
kubectl apply -f mysql-deployment.yml
kubectl apply -f mysql-service.yml

# Backend
kubectl apply -f backend-service.yml
kubectl apply -f backend-deployment.yml

# Frontend
kubectl apply -f frontend-service.yml
kubectl apply -f frontend-deployment.yml

# Ingress (needs an ingress controller installed first - see below)
kubectl apply -f ingress.yml

# Verify everything
kubectl get all -n three-tier
kubectl get pods -n three-tier -w
```

**Install an ingress controller (one-time):**
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/aws/deploy.yaml
```

**Access the app (quick demo without Ingress/LB):** temporarily patch `frontend-service`
to `NodePort` and hit `http://<worker-public-ip>:<nodeport>`, or use `kubectl port-forward`:
```bash
kubectl port-forward svc/frontend-service 3000:80 -n three-tier
```

### Deploy monitoring stack
```bash
cd ../monitoring
kubectl apply -f prometheus/prometheus-deployment.yml
kubectl apply -f grafana/grafana-deployment.yml
# Prometheus -> http://<worker-ip>:30090
# Grafana    -> http://<worker-ip>:30030  (login: admin / ChangeMe123! — change this!)
```

---

## 7. Jenkins Setup (one-time manual configuration)

```bash
ssh -i three-tier-devops-key.pem ubuntu@<jenkins-public-ip>
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```
1. Open `http://<jenkins-ip>:8080`, paste the password, install suggested plugins.
2. Install extra plugins: **Docker Pipeline, SonarQube Scanner, Kubernetes CLI, Pipeline: GitHub, Blue Ocean**.
3. Add credentials (**Manage Jenkins → Credentials**):
   - `dockerhub-creds` — Username/Password (your DockerHub login)
   - `kubeconfig-file` — Secret file: copy `/home/ubuntu/.kube/config` from the master node
   - `sonarqube-token` — Secret text: the token generated in SonarQube (see `sonarqube/SONARQUBE-SETUP.md`)
4. Configure SonarQube server URL under **Manage Jenkins → System** (see `sonarqube/SONARQUBE-SETUP.md`).
5. **New Item → Multibranch Pipeline** → point it at your GitHub repo → it auto-discovers
   `main`, `dev`, `test` branches and creates a separate job for each, each running the same `Jenkinsfile`.
6. Add a GitHub webhook (repo **Settings → Webhooks**) pointing to
   `http://<jenkins-ip>:8080/github-webhook/` so pushes trigger builds automatically.

---

## 8. Git Branching Strategy — "jaha change hoga wahi run hoga"

```
main   ──●────────●──────────●───►  Production (namespace: three-tier)   — needs manual approval
          \        \          \
dev    ────●──●──●──●────●────●───►  Dev (namespace: three-tier-dev)      — auto-deploy every push
                \              \
test   ──────────●──────────────●──►  QA/Test (namespace: three-tier-test) — auto-deploy on merge to test
```

- Feature work happens on `dev` → auto CI/CD to the dev namespace on every push.
- When stable, `dev` is merged into `test` → deploys to the test namespace for QA.
- When QA signs off, `test` is merged into `main` → pipeline pauses for **manual approval** before touching production.
- The `Jenkinsfile`'s **"Detect Changed Components"** stage runs `git diff --name-only HEAD~1 HEAD`
  and only rebuilds/redeploys `frontend` or `backend` depending on which folder actually changed —
  so a small CSS fix doesn't trigger a pointless backend rebuild.

---

## 9. Interview Talking Points (memorize these)

- **Why hostPath PV instead of EBS CSI?** — Simpler for a self-managed kubeadm demo cluster;
  in a real EKS setup you'd use the `aws-ebs-csi-driver` + a `StorageClass` for dynamic provisioning.
- **Why `Recreate` strategy for MySQL?** — The PVC is `ReadWriteOnce` (single node can mount it);
  `RollingUpdate` would try to start a new pod before killing the old one, causing a mount conflict.
- **Why separate ConfigMap and Secret?** — ConfigMap for non-sensitive config (ports, hostnames),
  Secret for credentials — different RBAC policies can be applied to each.
  In production you'd swap the raw K8s Secret for AWS Secrets Manager + External Secrets Operator.
  entities.
- **How does the HPA work?** — `backend-hpa` watches average CPU utilization across `backend-deployment`
  pods; if it crosses 70%, it scales up (max 5), and scales back down when load drops (min 2).
- **What does the Quality Gate actually block?** — New bugs, new vulnerabilities, insufficient
  coverage on new code — configured in SonarQube's "Sonar way" default gate.
- **Why Trivy in addition to SonarQube?** — SonarQube analyzes *your* source code; Trivy scans the
  *built container image* for OS-level and dependency CVEs — different layers, different tool.

---

## 10. Common Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `kubectl get nodes` shows worker `NotReady` | Flannel CNI not applied, or join happened before CNI was up | Re-check `kubectl apply -f kube-flannel.yml` ran on master |
| Backend pod `CrashLoopBackOff` | MySQL not ready yet | `waitForDb()` retry logic in `server.js` handles this; check `kubectl logs` |
| SonarQube container won't start | `vm.max_map_count` too low | userdata script already sets this; verify with `sysctl vm.max_map_count` |
| Jenkins can't run `docker build` | jenkins user not in docker group | `sudo usermod -aG docker jenkins && sudo systemctl restart jenkins` |
| Ingress 404 | Ingress controller not installed | Apply the ingress-nginx manifest from Step 6 |

---

## 11. Teardown (avoid AWS bill surprises)

```bash
cd terraform
terraform destroy    # type 'yes'
```
>>>>>>> a263e4e (Initial Commit of Project)
