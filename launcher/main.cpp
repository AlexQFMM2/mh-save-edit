#include <QApplication>
#include <QCommandLinkButton>
#include <QCoreApplication>
#include <QDialog>
#include <QDir>
#include <QFileInfo>
#include <QFont>
#include <QLabel>
#include <QMessageBox>
#include <QProcess>
#include <QStringList>
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

    QApplication app(argc, argv);
    QCoreApplication::setApplicationName(QStringLiteral("MH Save Editor"));
    QCoreApplication::setOrganizationName(QStringLiteral("AlexQFMM2"));

    QDialog dialog;
    dialog.setWindowTitle(QStringLiteral("MH 存档修改器"));
    dialog.setMinimumWidth(520);

    QVBoxLayout *layout = new QVBoxLayout(&dialog);
    layout->setContentsMargins(28, 24, 28, 24);
    layout->setSpacing(14);

    QLabel *title = new QLabel(QStringLiteral("选择要修改的游戏"), &dialog);
    QFont titleFont = title->font();
    titleFont.setPointSize(titleFont.pointSize() + 5);
    titleFont.setBold(true);
    title->setFont(titleFont);
    layout->addWidget(title);

    QLabel *description = new QLabel(
        QStringLiteral("两个修改器相互独立，启动后会使用各自的数据集和存档格式。"),
        &dialog);
    description->setWordWrap(true);
    layout->addWidget(description);

    QCommandLinkButton *mh3gButton = new QCommandLinkButton(
        QStringLiteral("MH3G / MH3U"),
        QStringLiteral("Nintendo 3DS 与 Wii U 存档"),
        &dialog);
    mh3gButton->setMinimumHeight(68);
    layout->addWidget(mh3gButton);

    QCommandLinkButton *mh4gButton = new QCommandLinkButton(
        QStringLiteral("MH4G"),
        QStringLiteral("Nintendo 3DS 存档"),
        &dialog);
    mh4gButton->setMinimumHeight(68);
    layout->addWidget(mh4gButton);

    QLabel *warning = new QLabel(QStringLiteral("修改前请先备份完整存档目录。"), &dialog);
    warning->setStyleSheet(QStringLiteral("color: #a33;"));
    layout->addWidget(warning);

    QObject::connect(mh3gButton, &QCommandLinkButton::clicked, [&dialog]() {
        if (launchEditor(MH3G, &dialog))
        {
            dialog.accept();
        }
    });
    QObject::connect(mh4gButton, &QCommandLinkButton::clicked, [&dialog]() {
        if (launchEditor(MH4G, &dialog))
        {
            dialog.accept();
        }
    });

    dialog.exec();
    return 0;
}
