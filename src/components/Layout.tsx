import Link from "next/link";
import React, { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

const Layout: React.FC<Props> = ({ children }) => {
  return (
    <>
      <section className="section">
        <div className="container">
          <div className="columns is-centered">
            <div className="column is-half-tablet is-two-third-desktop is-two-third-widescreen">
              <h1 className="title mt-6">✉️ BLUE DM</h1>
              <h2 className="subtitle mb-4 has-text-grey">
                Disguised Message on Bluesky
              </h2>

              <hr />

              {children}

              <hr />

              <div className="content">
                <ul>
                  <li>
                    <span>Developed by </span>
                    <Link href="https://bsky.app/profile/so-asano.com">
                      So Asano
                    </Link>

                    <span> with much help from </span>

                    <Link href="https://bsky.app/profile/ukawa.bsky.social">
                      Hirofumi Ukawa
                    </Link>
                    <span> and </span>
                    <Link href="https://chat.openai.com/">ChatGPT</Link>
                    <span>.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Layout;
