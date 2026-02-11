#!/bin/bash

# Pastikan script dijalankan sebagai root
if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit
fi

# 1. Update & Upgrade System
echo "Updating system..."
apt update && apt upgrade -y

# 2. Install Nginx
echo "Installing Nginx..."
apt install nginx -y

# 3. Setup Firewall (UFW)
echo "Configuring Firewall..."
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw --force enable

# 4. Create Nginx Config
DOMAIN="portal-mobeng.com" # GANTI INI DENGAN DOMAIN ANDA
CONFIG_FILE="/etc/nginx/sites-available/portal"

echo "Creating Nginx configuration for $DOMAIN..."

cat > $CONFIG_FILE <<EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;
    root /var/www/html;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# 5. Enable Site
echo "Enabling site..."
ln -s $CONFIG_FILE /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo "SETUP COMPLETE!"
echo "Sekarang upload folder 'dist' ke /var/www/html"
