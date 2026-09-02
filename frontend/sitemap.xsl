<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" 
    xmlns:html="http://www.w3.org/TR/REC-html40"
    xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
    <xsl:template match="/">
        <html xmlns="http://www.w3.org/1999/xhtml" lang="en">
            <head>
                <title>XML Sitemap | Alora Radiance</title>
                <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <style type="text/css">
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
                        color: #2A2A24;
                        background: #FAF7EE;
                        margin: 0;
                        padding: 30px 20px;
                    }
                    .container {
                        max-width: 1050px;
                        margin: 0 auto;
                        background: #FFFFFF;
                        border-radius: 24px;
                        border: 1px solid #ECE4CE;
                        padding: 32px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.03);
                    }
                    .header {
                        border-bottom: 1px solid #ECE4CE;
                        padding-bottom: 20px;
                        margin-bottom: 24px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        flex-wrap: wrap;
                        gap: 15px;
                    }
                    h1 {
                        font-size: 26px;
                        margin: 0 0 6px 0;
                        color: #152219;
                        font-weight: 700;
                    }
                    p.desc {
                        font-size: 13px;
                        color: #6B685F;
                        margin: 0;
                    }
                    .badge {
                        background: #F5EBE1;
                        color: #8B4513;
                        padding: 6px 14px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 700;
                        border: 1px solid #E4D2C1;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 13px;
                    }
                    th {
                        background: #FAF7EE;
                        color: #8B4513;
                        text-align: left;
                        padding: 12px 14px;
                        font-size: 11px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        border-bottom: 2px solid #ECE4CE;
                    }
                    td {
                        padding: 12px 14px;
                        border-bottom: 1px solid #F5F1E4;
                        vertical-align: middle;
                    }
                    tr:hover td {
                        background: #FCF9F2;
                    }
                    a {
                        color: #8B4513;
                        text-decoration: none;
                        font-weight: 600;
                    }
                    a:hover {
                        text-decoration: underline;
                        color: #A0522D;
                    }
                    .tag {
                        display: inline-block;
                        padding: 3px 8px;
                        border-radius: 6px;
                        font-size: 10px;
                        font-weight: 700;
                        text-transform: uppercase;
                    }
                    .tag-product { background: #E8F3EC; color: #1F7A55; }
                    .tag-blog { background: #FEF3C7; color: #92400E; }
                    .tag-page { background: #EFF6FF; color: #1E40AF; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div>
                            <h1>Alora Radiance XML Sitemap</h1>
                            <p class="desc">This is an indexed XML sitemap for search engines like Google, Bing and Yandex.</p>
                        </div>
                        <div class="badge">
                            Total URLs: <xsl:value-of select="count(sitemap:urlset/sitemap:url)"/>
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 50%;">URL Location</th>
                                <th style="width: 15%;">Type</th>
                                <th style="width: 15%;">Last Modified</th>
                                <th style="width: 10%;">Frequency</th>
                                <th style="width: 10%;">Priority</th>
                            </tr>
                        </thead>
                        <tbody>
                            <xsl:for-each select="sitemap:urlset/sitemap:url">
                                <tr>
                                    <td>
                                        <a href="{sitemap:loc}" target="_blank"><xsl:value-of select="sitemap:loc"/></a>
                                    </td>
                                    <td>
                                        <xsl:choose>
                                            <xsl:when test="contains(sitemap:loc, '/post/')">
                                                <span class="tag tag-blog">Blog Post</span>
                                            </xsl:when>
                                            <xsl:when test="contains(sitemap:loc, '/product/')">
                                                <span class="tag tag-product">Product</span>
                                            </xsl:when>
                                            <xsl:otherwise>
                                                <span class="tag tag-page">Page</span>
                                            </xsl:otherwise>
                                        </xsl:choose>
                                    </td>
                                    <td><xsl:value-of select="sitemap:lastmod"/></td>
                                    <td><xsl:value-of select="sitemap:changefreq"/></td>
                                    <td><strong><xsl:value-of select="sitemap:priority"/></strong></td>
                                </tr>
                            </xsl:for-each>
                        </tbody>
                    </table>
                </div>
            </body>
        </html>
    </xsl:template>
</xsl:stylesheet>
