# BlueDM Protocol Specification ver 1.0 2023/09/07

## Author
- Hirofumi Ukawa <hirofumi@ukawa.biz> @ukawa.bsky.social
  
## Overview
- The BlueDM protocol is a protocol designed to achieve **End-to-End Encryption (E2EE)** as an extension of the **ATProtocol**.
- The BlueDM protocol is implemented only on the client side.

## Matters Not Addressed in This Document
1. Matters related to the client's user interface.
2. Matters related to the laws and regulations of various countries.

## Disclaimer
1. Matters related to defects in the specification.
2. Matters related to defects in implementation or legal responsibilities.

## 1. Main Technologies and Their Purposes
1. XRPC Protocol
    - An extension to the ATProtocol.
2. Public Key Encryption
    - Mutual exchange of symmetric encryption keys.
    - Signing other fields.
        - This version does not address signing.
3. Symmetric Encryption
    - Used for encrypting messages.

## 2. Design Principles
1. Strive for a simple design whenever possible.
2. Allow flexibility in adapting to the obsolescence of encryption methods over time.
3. Describe the method of 1-to-1 communication.
4. In Version 1.0:
    - Use RSA as the public key encryption algorithm with a key length of 2048 bits. Use OAEP padding.
    - Use AES as the symmetric encryption algorithm with a key length of 256 bits.

## 3. Lexicons and Keys for Extension
1. [https://atproto.com/lexicons/app-bsky-actor#appbskyactorprofile](https://atproto.com/lexicons/app-bsky-actor#appbskyactorprofile)
    1. **Required**: Text indicating the BlueDM protocol version.
        - app.bsky.actor.profile.record.properties.bluedmVersion
        - Use Numeric. If following this document, set to 1.
    2. **Required**: Include the public key PEM file as-is in JSON.
        - app.bsky.actor.profile.record.properties.bluedmPublicKey
            - Place the PEM public key file as-is. Use \r\n for line breaks.
1. [https://atproto.com/lexicons/app-bsky-feed#appbskyfeedpost](https://atproto.com/lexicons/app-bsky-feed#appbskyfeedpost)
    1. **Required**: Text indicating the BlueDM protocol version.
        - app.bsky.feed.post.record.properties.bluedmVersion
        - Use Numeric. If following this document, set to 1.
    2. Encrypt the sender-generated shared key with the recipient's public key and encode in Base64.
        - app.bsky.feed.post.record.properties.bluedmSharedKey
        - Use Base64 Text. Include in the **Required: First Mention Post** from sender to recipient only.
        - Ensure Base64 padding on the sender side.
    3. Encrypt the sender-generated shared key with the sender's public key and encode in Base64.
        - app.bsky.feed.post.record.properties.bluedmSrcSharedKey
        - Use Base64 Text. Include in the **Required: First Mention Post** from sender to recipient only.
        - Usage: **Used by the sender to later view DM history**.
        - Ensure Base64 padding on the sender side.
    4. Encrypt messages both parties want to send using the shared key and encode in Base64.
        - app.bsky.feed.post.record.properties.bluedmSecretMessage
        - Encode the Post content in Base64 and provide as Text.
        - Ensure Base64 padding on the sender side.
        - Regarding content:
            - TEXT
                - Encrypt UTF-8 text, encode it in Base64, and include it.
                - If the text starts with '{', the behavior on the recipient's side is not defined.
                - Maximum character limit is not specified.
        - The sender may include this message when **initially sending the key**.

## 4. Client's Internal Operations
1. Fundamental Concepts
    1. A series of messages starts with a Mentioned Post at the beginning of the DM and is realized by Replies to that message.
    2. Clients detect this process from Notifications. Ignore the message even if it's included in a Repost.
    3. How to handle past DM history is implementation-dependent.
1. When Sending the First DM
    1. The sender verifies whether the recipient can receive DMs.
        - Obtain the recipient's Profile and verify bluedmVersion and bluedmPublicKey.
        - Verification method is implementation-dependent.
        - Behavior for recipients who can't receive the message is implementation-dependent.
    1. The sender generates the **shared key using random numbers** and performs the following two encryptions:
        - Encrypt with the recipient's public key.
        - Encrypt with the sender's public key.
    1. The recipient decrypts the received shared key using the recipient's private key for future use.
    1. The sender decrypts the sent shared key using the sender's private key for future use.
1. Subsequent DM Sending
    1. To prevent the DM from appearing on the timeline, subtract 100 years from the createdAt timestamp when sending.
    1. When displaying the recipient's message, add 100 years to the displayed timestamp.
    1. Both parties can exchange messages interactively.
1. Message History
    1. If there's an initiating mention, the message can be reconstructed, allowing continued sending and receiving.
1. Handling of Public and Private Keys
    1. The generated public key is stored in the Profile.
    2. The generated private key is stored in the client software.
    3. Considering use by multiple individuals and clients, it's desirable for each DID to store private keys separately, even within the same software environment. Exporting is also desired.
1. When Switching Browsers or When Saved Public and Private Keys Don't Match
    1. Ability to import private keys is desired.
    2. Ability to regenerate public and private keys when private key is missing is desired.
        1. Regeneration would render past data unreadable, but this is acceptable.
    3. As the private key can calculate the public key, it's acceptable to recalculate and set the public key when importing the user's private key.
1. Polling interval for Notification retrieval is implementation-dependent.


# BlueDM protocol 仕様書 ver1
2023/09/04
## 概要
- BlueDMプロトコルは**ATProtocolの拡張**として定義される**E2EE**を実現するプロトコルである
- BlueDMプロトコルはクライアントのみで実装される
## 著者
- Hirofumi Ukawa <hirofumi@ukawa.biz> @ukawa.bsky.social

***
## 本ドキュメントで言及しない事
1. クライアントのユーザーインターフェースに関わる事
2. 各国の法令に関わる事

## 免責事項
1. 仕様の不具合に関する事
2. 実装の不具合や、法的な責任に関する事

## 1. 利用する主な技術とその目的
1. XRPCプロトコル
    - ATProtocolに対してのExtentionである
1. 公開鍵暗号
    - 共通鍵暗号の相互交換
    - 他のフィールドへの署名
        - 本バージョンでは署名に関して言及しない
1. 共通鍵暗号
    - メッセージの暗号化に用いる

## 2. 設計方針
1. 可能な限りシンプルな設計とする
1. 暗号方式は時間の経過に伴って陳腐化する為、柔軟に対応できるようにする
1. 1対1の通信方法について記載する
1. Version 1.0 では
    - 公開鍵暗号として RSAを採用し、キー長は2048ビットを利用する。パディング方式はOAEPとする
    - 共通鍵暗号として AESを採用し、キー長は256ビットを利用する

## 3. 拡張するLexiconとキー
1. https://atproto.com/lexicons/app-bsky-actor#appbskyactorprofile
    1. **必須**:BlueDMのプロトコルバージョンのテキスト
        - app.bsky.actor.profile.record.properties.bluedmVersion
        - Numericで記述する。本ドキュメントに従う場合、1 である
    1. **必須**:公開鍵PEMファイルをそのままJSONに記載する
        - app.bsky.actor.profile.record.properties.bluedmPublicKey
            - PEM公開鍵ファイルをそのまま入れる。改行は\r\nで表記する
1. https://atproto.com/lexicons/app-bsky-feed#appbskyfeedpost
    1. **必須**:BlueDMのプロトコルバージョンのテキスト
        - app.bsky.feed.post.record.properties.bluedmVersion
        - Numericで記述する。本ドキュメントに従う場合、1 である     
    1. 送信元で生成した共通鍵を送信先の公開鍵で暗号化しBase64エンコードしたテキスト
        - app.bsky.feed.post.record.properties.bluedmSharedKey
        - Base64のTextで記述する。本キーは送信元から送信先への**必須：最初のMentionのPost**にのみ入れる
        - Base64のパディングは送信側で保証する
    1. 送信元で生成した共通鍵を送信元の公開鍵で暗号化しBase64エンコードしたテキスト
        - app.bsky.feed.post.record.properties.bluedmSrcSharedKey
        - Base64のTextで記述する。本キーは送信元から送信先への**必須：最初のMentionのPost**にのみ入れる
        - 利用方法： **送信元が後からDM履歴を閲覧する為に利用する**
        - Base64のパディングは送信側で保証する
    1. 双方が送りたいメッセージを共通鍵で暗号化しBase64エンコードしたテキスト
        - app.bsky.feed.post.record.properties.bluedmSecretMessage
        - Post内容をBase64でエンコードした内容を、Textで記述する。
        - Base64のパディングは送信側で保証する
        - 中身について
            - TEXT
                - UTF-8のテキストを暗号化しBase64でエンコードした物を入れる
                - テキストの先頭に文字'{'が含まれている場合の受信側の処理は規定しない
                - 利用できる文字数の最大値については規定しない
        - 送信側は、**最初の鍵送信時に一緒にこのメッセージを追記**してもよい
## 4. クライアントの内部動作について
1. 基本的な考え方
    1. 一連のメッセージは、全て最初のDM開始のMention付きのPostから開始され、そのメッセージへのReplyによって実現される
    2. クライアントはNotificationから、1. を検知する。Repostに本メッセージが含まれていても無視する
    3. 過去のDM履歴をどのように扱うかは実装依存とする
1. 最初のDM送信時
    1. 送信側は送信先がDM送信可能な相手かどうか検証する
        - 送信先のProfileを取得し、bluedmVersionとbluedmPublicKeyを確認する
        - 確認方法は実装依存とする
        - 送信できない相手の場合の動作は実装依存とする
    1. 送信側は**共有鍵を乱数により生成**し下記2つの暗号化を行う
        - 送信先の公開鍵により暗号化
        - 送信元の公開鍵により暗号化
    1. 受信側は受けた共通鍵を受信側の秘密鍵で復号化し以降、もしくは後で利用する
    1. 送信側は送信した共通鍵を送信側の秘密鍵で複合化し以降、もしくは後で利用する
1. 以降のDM送信時
    1. DMがタイムラインに浮上しないよう送信時のcreatedAtを送信日時から100年減算した値とする
    1. 相手のメッセージを表示する時、表示上は100年加算した値とする
    1. 双方が対照的にメッセージをやりとりできる
1. メッセージの履歴
    1. 起点となるメンションがあれば、メッセージは再現でき、かつ継続して送受信も継続できる
1. 公開鍵と秘密鍵の扱い
    1. 生成した公開鍵は、Profileに保存
    2. 生成した秘密鍵は、クライアントソフトで保存
    3. 複数名での利用、複数クライアントでの利用を加味し、秘密鍵は同一環境の同一ソフトであってもDID別に保存できる事が望ましく、またエクスポートができる事が望まれる
1. ブラウザを変更した時など保存された公開鍵と秘密鍵がペアでは無い場合
    1. 秘密鍵のインポートができる事が望まれる
    2. 秘密鍵が無い場合に、公開鍵と秘密鍵を再生成できる事が望まれる
        1. 再生成の結果、過去の送受信のデータは閲覧不能になるがこれを許容する
    3. 秘密鍵があれば公開鍵を計算できる為、ユーザーの秘密鍵のインポート時に公開鍵の再計算、設定をしても良い
1. Notification取得のポーリング間隔は実装に依存する
   
