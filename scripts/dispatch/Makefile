WORKER_USER ?= worker
WORKER_HOST ?= <aio-ip>

.PHONY: worker-ping worker-job

# make worker-ping
worker-ping:
	WORKER_USER=$(WORKER_USER) WORKER_HOST=$(WORKER_HOST) ./run-remote.sh "echo ok"

# make worker-job JOB=path/to/job.ps1
worker-job:
	@test -n "$(JOB)" || (echo "usage: make worker-job JOB=path/to/job.ps1" && exit 1)
	WORKER_USER=$(WORKER_USER) WORKER_HOST=$(WORKER_HOST) ./run-remote.sh -f "$(JOB)"
