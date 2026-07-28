#!/bin/bash
# ============================================
# Runs automatically on first boot of each Worker Node EC2 instance.
# This ONLY prepares the node (container runtime + kubelet/kubeadm).
# The actual "kubeadm join" step is run MANUALLY after copying the
# join command from the master (see README Step 5) - this is intentional
# so you can explain in the interview exactly how nodes join a cluster.
# ============================================
set -e
exec > /var/log/user-data.log 2>&1

echo ">>> Disabling swap"
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

echo ">>> Installing containerd"
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

echo ">>> Worker node prepared. SSH into master, run: cat /root/join-command.sh"
echo ">>> Then run that exact command here (as root/sudo) to join this node to the cluster."
