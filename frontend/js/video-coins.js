// Video Processing with Coins - Frontend
console.log('=== Video Coins System ===');

window.videoCoins = {
  // 1. Video Builder Coins nach Länge
  async processVideo(videoUrl, videoLength) {
    try {
      const res = await window.authFetch("https://logomakergermany-ultimate-backend-production.up.railway.app/api/process-video", {
        method: "POST",
        body: JSON.stringify({ 
          videoUrl: videoUrl,
          videoLength: videoLength 
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Video processing failed");
      }

      // Update coins display
      setTimeout(() => {
        window.loadCoins();
      }, 1000);

      console.log(`Video processing started: ${data.coinsUsed} coins used`);
      return data;

    } catch (err) {
      console.error('Video processing error:', err);
      alert(err.message || "Video-Verarbeitung fehlgeschlagen");
      throw err;
    }
  },

  // 2. Auto TikTok Export System
  async exportToTikTok(videoId, title, hashtags) {
    try {
      const res = await window.authFetch("https://logomakergermany-ultimate-backend-production.up.railway.app/api/export-tiktok", {
        method: "POST",
        body: JSON.stringify({ 
          videoId: videoId,
          title: title,
          hashtags: hashtags 
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "TikTok export failed");
      }

      // Update coins display
      setTimeout(() => {
        window.loadCoins();
      }, 1000);

      console.log(`TikTok export successful: ${data.coinsUsed} coins used`);
      return data;

    } catch (err) {
      console.error('TikTok export error:', err);
      alert(err.message || "TikTok-Export fehlgeschlagen");
      throw err;
    }
  },

  // Calculate video cost
  calculateVideoCost(videoLengthSeconds) {
    const coinsPerMinute = 10;
    return Math.ceil(videoLengthSeconds / 60) * coinsPerMinute;
  },

  // Format video length
  formatVideoLength(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
};

// Helper functions for video processing
window.processVideoWithCoins = async function(videoUrl, videoLength) {
  const cost = window.videoCoins.calculateVideoCost(videoLength);
  const formattedLength = window.videoCoins.formatVideoLength(videoLength);
  
  const confirmed = confirm(`Video verarbeiten (${formattedLength})? Kosten: ${cost} Coins`);
  
  if (confirmed) {
    return await window.videoCoins.processVideo(videoUrl, videoLength);
  }
};

window.exportToTikTokWithCoins = async function(videoId, title, hashtags) {
  const confirmed = confirm("Video zu TikTok exportieren? Kosten: 5 Coins");
  
  if (confirmed) {
    return await window.videoCoins.exportToTikTok(videoId, title, hashtags);
  }
};

console.log('Video Coins System loaded');
