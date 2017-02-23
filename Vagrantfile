# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure(2) do |config|
  config.vm.box = "ubuntu/xenial64"
  config.vm.network "forwarded_port", guest: 3000, host: 3000, host_ip: "127.0.0.1"
  config.vm.post_up_message = "
    Grafana should now be viewable (locally only) at: http://localhost:3000/
    (To edit dashboards, sign in as user: 'admin' password: 'admin')
  "
  
  config.vm.provider "virtualbox" do |vb|
    vb.memory = "2048"
  end
  
  config.vm.provision "ansible_local" do |ansible|
    ansible.playbook = "deploy.yml"
  end
end
