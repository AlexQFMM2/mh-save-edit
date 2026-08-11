#include <QApplication>
#include <QCoreApplication>
#include <QDialog>
#include <QDir>
#include <QFileInfo>
#include <QFont>
#include <QFrame>
#include <QHBoxLayout>
#include <QLabel>
#include <QMessageBox>
#include <QProcess>
#include <QPushButton>
#include <QStringList>
#include <QStyleFactory>
#include <QVBoxLayout>

namespace
{
struct EditorEntry
{
    QString name;
    QString relativeExecutable;
};

const EditorEntry MH3G = {
    QStringLiteral("MH3G / MH3U"),
    QStringLiteral("editors/mh3g/MH3USaveEditorGUI.exe")
};

const EditorEntry MH4G = {
    QStringLiteral("MH4G"),
    QStringLiteral("editors/mh4g/MH4GSaveEditor.exe")
};

QString editorPath(const EditorEntry &editor)
{
    return QDir(QCoreApplication::applicationDirPath()).filePath(editor.relativeExecutable);
}

bool launchEditor(const EditorEntry &editor, QWidget *parent)
{
    const QString executable = QDir::toNativeSeparators(editorPath(editor));
    const QFileInfo executableInfo(executable);
    if (!executableInfo.isFile())
    {
        QMessageBox::critical(
            parent,
            QStringLiteral("无法启动 %1").arg(editor.name),
            QStringLiteral("没有找到对应修改器：\n%1\n\n请重新解压完整发布包，不要只复制启动器。")
                .arg(executable));
        return false;
    }

    if (!QProcess::startDetached(executable, QStringList(), executableInfo.absolutePath()))
    {
        QMessageBox::critical(
            parent,
            QStringLiteral("无法启动 %1").arg(editor.name),
            QStringLiteral("系统未能启动：\n%1").arg(executable));
        return false;
    }

    return true;
}

int checkInstallation()
{
    return QFileInfo::exists(editorPath(MH3G)) && QFileInfo::exists(editorPath(MH4G)) ? 0 : 2;
}

void applyLauncherStyle(QApplication &app)
{
    app.setStyle(QStyleFactory::create("Fusion"));

    QFont font(QStringLiteral("Microsoft YaHei UI"));
    font.setStyleHint(QFont::SansSerif);
    font.setPointSize(10);
    app.setFont(font);

    app.setStyleSheet(R"STYLE(
        QDialog#launcherSurface {
            background: #f3f6fb;
            color: #182033;
        }
        QLabel {
            background: transparent;
        }
        QFrame#heroCard {
            background: qlineargradient(
                x1:0, y1:0, x2:1, y2:1,
                stop:0 #183f75,
                stop:1 #2f73c5
            );
            border: 0;
            border-radius: 16px;
        }
        QLabel#heroEyebrow {
            color: #cfe2fb;
            font-size: 11px;
            font-weight: 700;
        }
        QLabel#heroTitle {
            color: #ffffff;
            font-size: 27px;
            font-weight: 700;
        }
        QLabel#heroSubtitle {
            color: #e2edfb;
            font-size: 12px;
        }
        QLabel#sectionTitle {
            color: #26344c;
            font-size: 13px;
            font-weight: 700;
        }
        QFrame#gameCard {
            background: #ffffff;
            border: 1px solid #dce4ef;
            border-radius: 13px;
        }
        QFrame#gameCard:hover {
            border-color: #8eb2df;
        }
        QLabel#gameBadge {
            color: #2464b3;
            background: #eaf2fd;
            border-radius: 7px;
            padding: 4px 8px;
            font-size: 10px;
            font-weight: 700;
        }
        QLabel#gameTitle {
            color: #17223a;
            font-size: 19px;
            font-weight: 700;
        }
        QLabel#gameDescription {
            color: #6b7689;
            font-size: 11px;
        }
        QPushButton#openButton {
            color: #ffffff;
            background: #2769bd;
            border: 1px solid #2769bd;
            border-radius: 8px;
            padding: 9px 15px;
            min-height: 24px;
            font-weight: 700;
        }
        QPushButton#openButton:hover {
            background: #1f5ca9;
            border-color: #1f5ca9;
        }
        QPushButton#openButton:pressed {
            background: #194d8f;
        }
        QFrame#noticeCard {
            background: #fff8e8;
            border: 1px solid #f0dda8;
            border-radius: 10px;
        }
        QLabel#noticeText {
            color: #765b16;
            font-size: 11px;
        }
        QMessageBox {
            background: #f3f6fb;
        }
        QMessageBox QPushButton {
            color: #26344c;
            background: #ffffff;
            border: 1px solid #cfd8e6;
            border-radius: 7px;
            padding: 7px 14px;
            min-width: 76px;
        }
    )STYLE");
}
}

int main(int argc, char *argv[])
{
    bool checkOnly = false;
    for (int i = 1; i < argc; ++i)
    {
        if (QString::fromLocal8Bit(argv[i]) == QStringLiteral("--check-install"))
        {
            checkOnly = true;
        }
    }

    if (checkOnly)
    {
        QCoreApplication app(argc, argv);
        return checkInstallation();
    }

    QCoreApplication::setAttribute(Qt::AA_EnableHighDpiScaling);
    QCoreApplication::setAttribute(Qt::AA_UseHighDpiPixmaps);
    QApplication app(argc, argv);
    applyLauncherStyle(app);
    QCoreApplication::setApplicationName(QStringLiteral("MH Save Editor"));
    QCoreApplication::setOrganizationName(QStringLiteral("AlexQFMM2"));

    QDialog dialog;
    dialog.setObjectName(QStringLiteral("launcherSurface"));
    dialog.setWindowTitle(QStringLiteral("MH 存档修改器"));
    dialog.setMinimumSize(680, 480);
    dialog.resize(720, 500);

    QVBoxLayout *layout = new QVBoxLayout(&dialog);
    layout->setContentsMargins(24, 24, 24, 22);
    layout->setSpacing(16);

    QFrame *heroCard = new QFrame(&dialog);
    heroCard->setObjectName(QStringLiteral("heroCard"));
    QVBoxLayout *heroLayout = new QVBoxLayout(heroCard);
    heroLayout->setContentsMargins(24, 20, 24, 22);
    heroLayout->setSpacing(7);

    QLabel *eyebrow = new QLabel(QStringLiteral("MONSTER HUNTER SAVE TOOLS"), heroCard);
    eyebrow->setObjectName(QStringLiteral("heroEyebrow"));
    QLabel *title = new QLabel(QStringLiteral("选择要修改的游戏"), heroCard);
    title->setObjectName(QStringLiteral("heroTitle"));
    QLabel *description = new QLabel(
        QStringLiteral("统一入口，独立运行。每个版本使用自己的存档结构和数据集。"),
        heroCard);
    description->setObjectName(QStringLiteral("heroSubtitle"));
    description->setWordWrap(true);
    heroLayout->addWidget(eyebrow);
    heroLayout->addWidget(title);
    heroLayout->addWidget(description);
    layout->addWidget(heroCard);

    QLabel *sectionTitle = new QLabel(QStringLiteral("游戏版本"), &dialog);
    sectionTitle->setObjectName(QStringLiteral("sectionTitle"));
    layout->addWidget(sectionTitle);

    auto createGameCard = [&dialog](
        const QString &badgeText,
        const QString &titleText,
        const QString &descriptionText,
        const EditorEntry &editor) -> QFrame *
    {
        QFrame *card = new QFrame(&dialog);
        card->setObjectName(QStringLiteral("gameCard"));
        QVBoxLayout *cardLayout = new QVBoxLayout(card);
        cardLayout->setContentsMargins(18, 16, 18, 17);
        cardLayout->setSpacing(8);

        QLabel *badge = new QLabel(badgeText, card);
        badge->setObjectName(QStringLiteral("gameBadge"));
        badge->setSizePolicy(QSizePolicy::Maximum, QSizePolicy::Preferred);
        QLabel *gameTitle = new QLabel(titleText, card);
        gameTitle->setObjectName(QStringLiteral("gameTitle"));
        QLabel *gameDescription = new QLabel(descriptionText, card);
        gameDescription->setObjectName(QStringLiteral("gameDescription"));
        gameDescription->setWordWrap(true);
        QPushButton *openButton = new QPushButton(QStringLiteral("打开修改器"), card);
        openButton->setObjectName(QStringLiteral("openButton"));
        openButton->setCursor(Qt::PointingHandCursor);

        cardLayout->addWidget(badge, 0, Qt::AlignLeft);
        cardLayout->addWidget(gameTitle);
        cardLayout->addWidget(gameDescription);
        cardLayout->addStretch(1);
        cardLayout->addWidget(openButton);

        QObject::connect(openButton, &QPushButton::clicked, [&dialog, editor]() {
            if (launchEditor(editor, &dialog))
            {
                dialog.accept();
            }
        });
        return card;
    };

    QHBoxLayout *gamesLayout = new QHBoxLayout();
    gamesLayout->setSpacing(14);
    gamesLayout->addWidget(createGameCard(
        QStringLiteral("3DS · Wii U"),
        QStringLiteral("MH3G / MH3U"),
        QStringLiteral("支持 Nintendo 3DS 与 Wii U 角色存档。"),
        MH3G));
    gamesLayout->addWidget(createGameCard(
        QStringLiteral("3DS"),
        QStringLiteral("MH4G"),
        QStringLiteral("支持 Nintendo 3DS MH4G 角色存档。"),
        MH4G));
    layout->addLayout(gamesLayout, 1);

    QFrame *noticeCard = new QFrame(&dialog);
    noticeCard->setObjectName(QStringLiteral("noticeCard"));
    QHBoxLayout *noticeLayout = new QHBoxLayout(noticeCard);
    noticeLayout->setContentsMargins(13, 9, 13, 9);
    QLabel *warning = new QLabel(QStringLiteral("修改前请备份完整存档目录；不要只复制启动器文件。"), noticeCard);
    warning->setObjectName(QStringLiteral("noticeText"));
    noticeLayout->addWidget(warning);
    layout->addWidget(noticeCard);

    dialog.exec();
    return 0;
}
