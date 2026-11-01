(function () {
  'use strict';
  var band = /^https:\/\/beyond\.spalla\.io\/cache\/config\/([a-f0-9-]{36})(?:\?.*)?$/i;
  var daily = /^https:\/\/www\.dailymotion\.com\/player\/metadata\/video\/([a-z0-9]+)(?:\?.*)?$/i;
  function json(url) {
    return Promise.race([
      fetch(url, { credentials: 'omit' }).then(function (r) {
        if (!r.ok) throw new Error('Public player unavailable');
        return r.json();
      }),
      new Promise(function (_, reject) { setTimeout(function () { reject(new Error('Public player timeout')); }, 12000); })
    ]);
  }
  function resolve(url) {
    var m = band.exec(url);
    if (m) {
      var id = m[1], root = 'https://beyond.spalla.io';
      return json(root + '/cache/auth/' + id + '?live=' + id + '&r=' + encodeURIComponent('https://www.band.com.br/ao-vivo') + '&i=1').then(function (auth) {
        if (auth.status !== 'ok' || auth.gated) throw new Error('Official player declined access');
        var uid = auth.uid || '';
        return json(root + '/cache/config/' + id + '?_t=' + Date.now() + '&uid=' + encodeURIComponent(uid)).then(function (c) {
          if (c.lm_live_pausada || c.lm_live_terminada) throw new Error('Broadcast offline');
          var list = c.lm_live_cdns || [], cdn = list.filter(function (x) { return x.Nome === c.lm_live_cdn_inicial; })[0] || list[0];
          if (!cdn || !/^https:\/\//i.test(cdn.URL)) throw new Error('Missing official stream');
          var path = c.sp_usar_super_playlist ? '/super_playlist.m3u8' : c.sp_sinais_tem_a === false && c.sp_sinais_tem_b ? '/s2/playlist_nova-b.m3u8' : '/s1/playlist_nova-a.m3u8';
          var target = cdn.URL + id + path;
          if (c.lm_live_jwt) {
            if (!c.lm_live_jwt_token) throw new Error('Missing playback session');
            target += '?sjwt=' + encodeURIComponent(c.lm_live_jwt_token) + '&uid=' + encodeURIComponent(uid);
          }
          return target;
        });
      });
    }
    m = daily.exec(url);
    if (m) return json('https://www.dailymotion.com/player/metadata/video/' + m[1]).then(function (c) {
      if (c.error || c.protected_delivery) throw new Error('Official player declined access');
      var sources = c.qualities && c.qualities.auto || [];
      var hls = sources.filter(function (x) { return /mpegurl/i.test(x.type || '') && /^https:\/\//i.test(x.url || ''); })[0];
      if (!hls) throw new Error('No public HLS stream');
      return hls.url;
    });
    return Promise.reject(new Error('Unsupported public player'));
  }
  resolve.supports = function (url) { return band.test(url) || daily.test(url); };
  window.__resolveIPTVSource = resolve;
})();
