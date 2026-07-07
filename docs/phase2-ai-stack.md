# Phase 2: AI / CUDA Stack

Install after the base system and VFIO setup are working (`phase2-vfio-setup.md`).

## Install

```sh
sudo pacman -S --needed $(cat scripts/arch-install/packages-ai.txt)
```

This pulls in `nvidia-open` (open-source kernel modules — use plain
`nvidia` instead if your card predates Turing) for the **host-resident**
GPU. If your setup has no discrete card left for the host (single-GPU
passthrough with no iGPU), skip the Nvidia driver packages entirely and
either run AI workloads on CPU or plan for a dedicated third card.

## Verify the driver

```sh
nvidia-smi
```

Should list the host GPU, driver version, and CUDA version.

## Verify PyTorch sees the GPU

```sh
python -c "import torch; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```

Should print `True` and the GPU's name.

## Container fallback

If the host driver conflicts with anything related to the passthrough setup
(e.g. you want to keep the host driver stack minimal/stable and isolate AI
dependency churn), use the container path instead of bare-metal CUDA:

```sh
sudo pacman -S --needed nvidia-container-toolkit docker
sudo systemctl enable --now docker
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi
```

This keeps CUDA/cuDNN/PyTorch versions pinned per-project inside containers
instead of on the host, which achieves the same "isolate volatile AI
dependency stacks" goal the original project brief associated with NixOS,
just via containers on top of the Arch base chosen here instead.
