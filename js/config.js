const CONFIG = {
  API_BASE_URL: 'https://image.pollinations.ai/p/',
  DEFAULT_WIDTH: 1024,
  DEFAULT_HEIGHT: 1024,
  ENGINE_MAP: {
    'Phoenix — Photorealism': { model: 'flux', style: 'photorealistic, highly detailed, sharp focus, 8K' },
    'SDXL — Universal': { model: 'gptimage', style: '' },
    'DreamForge — Concept Art': { model: 'flux', style: 'concept art, fantasy art, intricate details, dramatic lighting, epic' },
    'Flux — Fast': { model: 'flux', style: '' },
    'AnimeXL — Anime Style': { model: 'flux', style: 'anime style, vibrant colors, cel shaded, Japanese animation style' },
    'WaifuStudio — Waifu Art': { model: 'flux', style: 'anime waifu style, cute character, detailed anime art' },
    'VelvetRender — Artistic': { model: 'flux', style: 'digital painting, velvet texture, artistic, smooth gradients, soft lighting' },
  },
};
