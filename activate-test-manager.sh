#!/bin/bash

# Email Assist 测试管理员激活脚本
# 用于激活testManager代理并初始化测试环境

set -e  # 遇到错误立即退出

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_header() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "    Email Assist 测试管理员激活器"
    echo "=========================================="
    echo -e "${NC}"
}

print_success() {
    print_message $GREEN "✅ $1"
}

print_warning() {
    print_message $YELLOW "⚠️  $1"
}

print_error() {
    print_message $RED "❌ $1"
}

print_info() {
    print_message $BLUE "ℹ️  $1"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查文件是否存在
file_exists() {
    [ -f "$1" ]
}

# 检查目录是否存在
dir_exists() {
    [ -d "$1" ]
}

# 主函数
main() {
    print_header
    
    print_info "正在激活测试管理员代理..."
    
    # 检查必要的环境
    check_environment
    
    # 验证测试目录结构
    check_test_structure
    
    # 检查测试配置文件
    check_test_configs
    
    # 检查依赖工具
    check_dependencies
    
    # 运行测试环境检查
    run_environment_check
    
    print_success "测试管理员代理已成功激活！"
    
    # 显示使用指南
    show_usage_guide
}

# 检查基础环境
check_environment() {
    print_info "检查基础环境..."
    
    # 检查Node.js
    if command_exists node; then
        local node_version=$(node --version)
        print_success "Node.js已安装: $node_version"
    else
        print_error "Node.js未安装，请先安装Node.js 18+"
        exit 1
    fi
    
    # 检查Python
    if command_exists python3; then
        local python_version=$(python3 --version)
        print_success "Python已安装: $python_version"
    else
        print_error "Python3未安装，请先安装Python 3.11+"
        exit 1
    fi
    
    # 检查项目根目录
    if file_exists "package.json"; then
        print_success "在正确的项目根目录中"
    else
        print_error "请在项目根目录中执行此脚本"
        exit 1
    fi
}

# 检查测试目录结构
check_test_structure() {
    print_info "验证测试目录结构..."
    
    local required_dirs=(
        "tests"
        "tests/unit"
        "tests/integration" 
        "tests/e2e"
        "test-config"
        "test-data"
        "test-reports"
        "test-docs"
    )
    
    for dir in "${required_dirs[@]}"; do
        if dir_exists "$dir"; then
            print_success "目录存在: $dir"
        else
            print_warning "目录缺失: $dir，正在创建..."
            mkdir -p "$dir"
            print_success "已创建目录: $dir"
        fi
    done
}

# 检查测试配置文件
check_test_configs() {
    print_info "检查测试配置文件..."
    
    local config_files=(
        "test-config/playwright.config.ts:Playwright E2E测试配置"
        "test-config/jest.config.js:Jest单元测试配置"
        "test-config/pytest.ini:Pytest后端测试配置"
        ".claude/agents/testManager.md:测试管理员代理配置"
        "test-docs/TEST_STRATEGY.md:测试策略文档"
        "test-docs/TEST_CASES.md:测试用例文档"
    )
    
    for item in "${config_files[@]}"; do
        local file="${item%:*}"
        local description="${item#*:}"
        
        if file_exists "$file"; then
            print_success "$description 已存在"
        else
            print_warning "$description 缺失: $file"
        fi
    done
}

# 检查依赖工具
check_dependencies() {
    print_info "检查测试工具依赖..."
    
    # 检查npm依赖
    if file_exists "node_modules"; then
        print_success "前端依赖已安装"
    else
        print_warning "正在安装前端依赖..."
        npm install
        print_success "前端依赖安装完成"
    fi
    
    # 检查Playwright浏览器
    if command_exists playwright; then
        print_success "Playwright已安装"
    else
        print_warning "正在安装Playwright浏览器..."
        npx playwright install --with-deps
        print_success "Playwright浏览器安装完成"
    fi
    
    # 检查后端依赖
    if dir_exists "backend" && file_exists "backend/requirements.txt"; then
        print_info "检查后端Python依赖..."
        cd backend
        if python3 -c "import pytest" 2>/dev/null; then
            print_success "后端测试依赖已安装"
        else
            print_warning "正在安装后端依赖..."
            pip3 install -r requirements.txt 2>/dev/null || true
            pip3 install -r requirements-dev.txt 2>/dev/null || true
            print_success "后端依赖安装完成"
        fi
        cd ..
    fi
}

# 运行测试环境检查
run_environment_check() {
    print_info "运行测试环境检查..."
    
    # 检查Jest
    if npm run test:unit -- --version >/dev/null 2>&1; then
        print_success "Jest单元测试环境正常"
    else
        print_warning "Jest环境需要配置，请检查jest.config.js"
    fi
    
    # 检查Playwright
    if npx playwright --version >/dev/null 2>&1; then
        print_success "Playwright E2E测试环境正常"
    else
        print_warning "Playwright环境需要配置，请检查playwright.config.ts"
    fi
    
    # 检查Pytest
    if dir_exists "backend"; then
        cd backend
        if python3 -m pytest --version >/dev/null 2>&1; then
            print_success "Pytest后端测试环境正常"
        else
            print_warning "Pytest环境需要配置，请检查pytest.ini"
        fi
        cd ..
    fi
    
    # 创建测试报告目录
    mkdir -p test-reports/{coverage,html,junit,allure,playwright-report}
    print_success "测试报告目录已准备就绪"
}

# 显示使用指南
show_usage_guide() {
    echo
    print_info "================ 使用指南 ================"
    echo
    echo -e "${GREEN}🚀 快速开始:${NC}"
    echo "  npm run test:unit          # 运行前端单元测试"
    echo "  npm run test:e2e           # 运行E2E测试"  
    echo "  cd backend && pytest       # 运行后端测试"
    echo
    echo -e "${GREEN}📋 测试管理员主要功能:${NC}"
    echo "  • 测试策略制定和维护"
    echo "  • 自动化测试框架建设"
    echo "  • 测试用例设计和执行"
    echo "  • 测试结果分析和报告"
    echo "  • 与开发团队协作调试"
    echo
    echo -e "${GREEN}📖 相关文档:${NC}"
    echo "  • 测试策略: test-docs/TEST_STRATEGY.md"
    echo "  • 测试用例: test-docs/TEST_CASES.md"
    echo "  • 自动化指南: test-docs/AUTOMATION_GUIDE.md"
    echo
    echo -e "${GREEN}💬 激活测试管理员对话:${NC}"
    echo '  在Claude对话中输入: "请激活testManager代理，我需要进行测试相关工作"'
    echo
    echo -e "${YELLOW}⚡ 提示: 使用 npm run test:help 查看所有可用的测试命令${NC}"
    echo
    print_info "========================================="
}

# 错误处理
error_handler() {
    print_error "脚本执行过程中出现错误，请检查上述输出信息"
    exit 1
}

# 设置错误处理
trap error_handler ERR

# 执行主函数
main "$@"
