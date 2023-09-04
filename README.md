# BlueDM protocol 仕様書 ver1.0.1 2023/09/04
## 概要
- BlueDMプロトコルは**ATProtocolの拡張**として定義される**E2EE**を実現するプロトコルである
- BlueDMプロトコルはクライアントのみで実装される
## ライセンス
- 本ドキュメントは CC-BY-SA とします
- 原本の著作者は "Hirofumi Ukawa <hirofumi@ukawa.biz>" です

***
## 本ドキュメントで言及しない事
1. クライアントのユーザーインターフェースに関わる事
2. 各国の法令に関わる事

## 免責事項
1. 仕様の不具合に関する事
2. 実装の不具合や、法的な責任に関する事

## 1. 利用する主な技術とその目的
1. XRPCプロトコル
    - 既存のATProtocolに対してのExtentionである
2. 公開鍵暗号
    - 共通鍵暗号の相互交換
    - 他のフィールドへの署名
3. 共通鍵暗号
    - メッセージの暗号化に用いる

## 2. 設計方針
- 可能な限りシンプルな設計とする
- 暗号方式は時間の経過に伴って陳腐化する為、柔軟に対応できるようにする
- １対１の通信方法について記載する
- Version 1.0 に於いては
    - 公開鍵暗号として RSAを採用し、キー長は2048ビットを利用する。パディング方式はOAEPとする
    - 共通鍵暗号として AESを採用し、キー長は256ビットを利用する。

## 3. 拡張するLexiconとキー
- https://atproto.com/lexicons/app-bsky-actor#appbskyactorprofile
    - 必須 BlueDMのプロトコルバージョンのテキスト
        - app.bsky.actor.profile.record.properties.bluedmVersion
        - Numericで記述する。本ドキュメントの仕様書に従う場合、 1 である
    - 必須 公開鍵PEMファイルをBase64でエンコードしたテキスト
        - app.bsky.actor.profile.record.properties.bluedmPublicKey
            - .PublicKeyVersion
                - 利用できる公開鍵のRFCバージョンをNumericの配列で示す、自身が利用する公開鍵のバージョンは0番目に入れる
                    - 今バージョンのデフォルトは、8017 とする
            - .CommonKeyVersion
                - 利用できる共通鍵のRFCバージョンをNumericで配列で示す、自身が利用する共通鍵のバージョンは0番目に入れる
                    - 今バージョンのデフォルトは、3826 とする
            - .PublicKeyLength
                - 公開鍵のキー長を配列でしめす。並びは、PublicKeyVersionと同一とする
                    - 今バージョンのデフォルトは、2048 とする
            - .CommonKeyLength
                - 共通鍵のキー長を配列で記載する（利用する共通鍵のキー長の最大値）並びはCommonKeyVersionと同一とする。
                    - 今バージョンのデフォルトは、256 とする
            - .PublicKey
                - 公開鍵ファイルをBase64でエンコードした物とする
                    - Base64のパディングは、**Profile更新時の処理されている**事とする
- https://atproto.com/lexicons/app-bsky-feed#appbskyfeedpost
    - 必須 BlueDMのプロトコルバージョンのテキスト
        - app.bsky.feed.post.record.properties.bluedmVersion
        - Numericで記述する。本ドキュメントの仕様書にそう場合、 1 である
    - 送信元で生成した共通鍵を送信先の公開鍵で暗号化しBase64エンコードしたテキスト
        - app.bsky.feed.post.record.properties.bluedmSharedKey
        - Textで記述する。本キーは送信元から送信先への**最初のMentionのPost**にのみ入れる
        - Base64のパディングは送信側で保証する
    - 送信元で生成した共通鍵を送信元の公開鍵で暗号化しBase64エンコードしたテキスト
        - app.bsky.feed.post.record.properties.bluedmMySharedKey
        - Textで記述する。本キーは送信元から送信先への**最初のMentionのPost**にのみ入れる
        - 利用方法： 送信元が後からDM履歴を閲覧する為に利用する
        - Base64のパディングは送信側で保証する
    - 双方が送りたいメッセージを共通鍵で暗号化しBase64エンコードしたテキスト
        - app.bsky.feed.post.record.properties.bluedmPost
        - Post内容をBase64でエンコードした内容を、Textで記述する。
        - Base64のパディングは送信側で保証する
        - 中身について
            - JSON
                - https://atproto.com/lexicons/app-bsky-feed#appbskyfeedpost のRecordに準拠する
            - TEXT
                - JSONでは無い場合は、テキストとして扱う
