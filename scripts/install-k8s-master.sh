#!/bin/bash
# ============================================
# Runs automatically on first boot of the Control Plane EC2 instance
# (kubeadm-based self-managed Kubernetes cluster)
# ============================================
set -e
exec > /var/log/user-data.log 2>&1

echo ">>> Disabling swap (mandatory for kubelet)"
swapoff -a
sed -i '/ swap / s/^/#/' /etc/fstab

echo ">>> Loading required kernel modules"
cat <<EOF | tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
modprobe overlay
modprobe br_netfilter

cat <<EOF | tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sysctl --system

echo ">>> Installing containerd (container runtime)"
apt-get update -y
apt-get install -y containerd
mkdir -p /etc/containerd
containerd config default | tee /etc/containerd/config.toml
sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
systemctl restart containerd
systemctl enable containerd

echo ">>> Installing kubeadm, kubelet, kubectl"
apt-get install -y apt-transport-https ca-certificates curl gpg
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /' | tee /etc/apt/sources.list.d/kubernetes.list
apt-get update -y
apt-get install -y kubelet kubeadm kubectl
apt-mark hold kubelet kubeadm kubectl

echo ">>> Initializing the control plane"
MASTER_IP=$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)
kubeadm init --pod-network-cidr=10.244.0.0/16 --apiserver-advertise-address=$MASTER_IP | tee /root/kubeadm-init.log

echo ">>> Setting up kubectl for ubuntu user"
mkdir -p /home/ubuntu/.kube
cp -i /etc/kubernetes/admin.conf /home/ubuntu/.kube/config
chown ubuntu:ubuntu /home/ubuntu/.kube/config

echo ">>> Installing Flannel CNI plugin (pod networking)"
export KUBECONFIG=/etc/kubernetes/admin.conf
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml

echo ">>> Generating worker join command (saved for reference)"
kubeadm token create --print-join-command > /root/join-command.sh
chmod +x /root/join-command.sh

echo ">>> Control plane setup complete. Run: cat /root/join-command.sh on this node to get worker join command"
