#!/bin/bash

# 数据库初始化脚本
# 创建开发数据库并运行所有迁移

set -e  # 遇到错误立即退出

# 数据库配置
DB_HOST="localhost"
DB_PORT="5432" 
DB_USER="postgres"
DB_PASSWORD="password"
DB_NAME="email_assist_dev"

echo "🚀 正在初始化Email Assist开发数据库..."

# 检查PostgreSQL是否运行
if ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; then
    echo "❌ 无法连接到PostgreSQL服务器"
    echo "请确保PostgreSQL服务正在运行，并且连接配置正确："
    echo "  Host: $DB_HOST"
    echo "  Port: $DB_PORT"
    echo "  User: $DB_USER"
    exit 1
fi

echo "✅ PostgreSQL服务器连接正常"

# 创建数据库（如果不存在）
echo "📦 创建数据库: $DB_NAME"
PGPASSWORD=$DB_PASSWORD createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME 2>/dev/null || {
    echo "ℹ️  数据库 $DB_NAME 已存在，跳过创建"
}

# 运行迁移脚本
echo "🔄 运行数据库迁移..."

MIGRATION_DIR="src/database/migrations"

if [ ! -d "$MIGRATION_DIR" ]; then
    echo "❌ 迁移目录不存在: $MIGRATION_DIR"
    exit 1
fi

# 按顺序运行所有迁移文件
for migration_file in $MIGRATION_DIR/*.sql; do
    if [ -f "$migration_file" ]; then
        echo "📄 运行迁移: $(basename $migration_file)"
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration_file" -v ON_ERROR_STOP=1
        if [ $? -eq 0 ]; then
            echo "✅ $(basename $migration_file) 执行成功"
        else
            echo "❌ $(basename $migration_file) 执行失败"
            exit 1
        fi
    fi
done

echo ""
echo "🎉 数据库初始化完成！"
echo ""
echo "数据库信息："
echo "  名称: $DB_NAME"
echo "  主机: $DB_HOST:$DB_PORT"
echo "  用户: $DB_USER"
echo ""
echo "您现在可以启动应用程序："
echo "  npm run dev"
echo ""

# 显示已创建的表
echo "📋 已创建的数据表："
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "\dt" -t | awk '{print "  - " $3}' | grep -v "^  - $"

echo ""
echo "🔧 如果需要重置数据库，请运行："
echo "  npm run db:reset"