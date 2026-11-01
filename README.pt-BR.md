# Brazil TV para webOS

[Français](README.md) · Português

**Seleção preparada e testada a partir da França**, em uma LG OLED CX com webOS 5.6.2. As escolhas de fontes e qualidade correspondem a esse uso; disponibilidade em outros países não foi validada. Não há remoção de geobloqueios.

Uma seleção de canais brasileiros HD e uma personalização independente do
[webOS IPTV Player](https://github.com/lennylxx/webos-iptv-player) de **lennylxx**.
Este projeto não é uma versão oficial do aplicativo original ou de qualquer emissora.

## Listas / Playlists

Adicione **uma** destas URLs ao seu leitor. A busca reúne os canais da lista escolhida.

| Leitor | URL | Canais na publicação inicial |
| --- | --- | --- |
| Brazil TV deste projeto | `https://raw.githubusercontent.com/Djyms/brazil-tv-webos/main/brasil-braziltv.m3u` | 167 |
| Outros leitores M3U | `https://raw.githubusercontent.com/Djyms/brazil-tv-webos/main/brasil.m3u` | 164 |

A lista Brazil TV inclui três páginas de players públicos que o aplicativo resolve
ao iniciar a reprodução: Band, TV Gazeta e Rede Vida. Elas não são URLs HLS diretas;
a lista padrão as omite para funcionar em outros leitores.

Os canais são agrupados por tema. As indicações 720p/1080p correspondem aos testes
realizados na seleção original; disponibilidade e resolução podem mudar.
Não há assinatura, conta de IPTV, lista paga, chave DRM ou vídeo hospedado neste repositório.
Nenhuma restrição de conta, acesso ou localização é removida. Um link público não
concede direitos sobre o conteúdo: utilize apenas onde a transmissão for autorizada.

O snapshot público omite o link Globo/TV Bahia cuja origem não foi confirmada e
um link Unisul com token. Ele é diferente da configuração pessoal de 169 canais.
Fontes da seleção e exclusões: [sources.json](sources.json).

## Aplicativo

Baixe o arquivo `.ipk` em **Releases** e instale pelo webOS Dev Manager ou pelas
ferramentas de desenvolvimento webOS. Identificador: `com.djyms.braziltv`.
Ele pode coexistir com `com.lennylxx.iptv`; não migra favoritos, histórico ou
configurações pessoais. Depois, adicione a URL Brazil TV acima nas configurações
de playlists do aplicativo.

Personalizações:

- Ícone Brazil TV com fundo preto.
- Recuperação da lista enviada após o início do serviço, evitando o estado de zero canais.
- Correção da área de configurações em webOS 5.
- HLS opt-in por canal e preferência HD para os canais explicitamente marcados.
- Resolução de sessões de players públicos, respeitando recusa de acesso e conteúdo protegido.

As traduções e os recursos do leitor original são preservados. A base é a versão
**1.17.0**, com uma revisão Brazil TV separada. O código e as licenças originais
continuam disponíveis no projeto de origem. Não se trata de um novo player criado do zero.

## Build reproduzível

Requer Node.js 20 ou mais recente e acesso à Internet. O empacotamento utiliza a
ferramenta oficial webOS CLI 3.2.6, fixada nas dependências de desenvolvimento.

```sh
npm ci
npm run build
npm test
```

O script baixa o IPK oficial 1.17.0 e hls.js 1.6.16, verifica hashes SHA-256 fixos,
aplica as transformações documentadas e usa o empacotador oficial para criar
`dist/com.djyms.braziltv_1.17.0_all.ipk`.
Os arquivos `SHA256SUMS` e `build-info.json` acompanham o resultado. As verificações
estáticas de um pacote não substituem os testes no televisor; consulte as notas da release.
Nenhum arquivo, endereço ou credencial do televisor pessoal é usado pelo build.

## English

An unofficial Brazil-focused customization kit and channel selection. Use the first
playlist with this build and the second with ordinary M3U players. The build downloads
checksum-pinned upstream artifacts, preserves their notices, and applies the published
transformations. No user data, subscriptions, DRM keys or hosted video are included.
Stream availability is not guaranteed. This project is not affiliated with broadcasters,
LG, streaming platforms or the original player author.

## Licenças e créditos

Code/customization kit: Apache-2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE).
Original player: lennylxx. hls.js: video-dev / Dailymotion, Apache-2.0.
Collections: iptv-org/iptv, Free-TV/IPTV and iptv-com/iptv; the links and channel artwork
retain their respective ownership. Requests to correct or remove a link are welcome
through the repository's Issues page.
