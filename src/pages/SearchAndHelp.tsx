import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
  Autocomplete,
  Popper,
  ClickAwayListener,
  Fade,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  History as HistoryIcon,
  Help as HelpIcon,
  Article as ArticleIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Description as DocumentIcon,
  Settings as SettingsIcon,
  Star as StarIcon,
  AccessTime as TimeIcon,
  TrendingUp as TrendingIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Clear as ClearIcon,
  BookmarkBorder as BookmarkIcon,
  Share as ShareIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  MoreVert as MoreIcon,
  AutoAwesome as AIIcon,
} from '@mui/icons-material';

import {
  searchService,
  SearchQuery,
  SearchResponse,
  SearchResult,
  AutocompleteSuggestion,
} from '../services/searchService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
  </div>
);

const getIconByType = (type: string) => {
  switch (type) {
    case 'email':
      return <EmailIcon />;
    case 'contact':
      return <PersonIcon />;
    case 'document':
      return <DocumentIcon />;
    case 'help':
      return <HelpIcon />;
    case 'feature':
      return <SettingsIcon />;
    case 'setting':
      return <SettingsIcon />;
    default:
      return <ArticleIcon />;
  }
};

const SearchAndHelp: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [query, setQuery] = useState('');
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [popularQueries, setPopularQueries] = useState<Array<{ query: string; count: number }>>([]);

  // 搜索选项
  const [searchFilters, setSearchFilters] = useState<SearchQuery>({
    query: '',
    type: undefined,
    sortBy: 'relevance',
    sortOrder: 'desc',
    fuzzy: true,
    semantic: false,
    limit: 20
  });

  // UI状态
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (query.length > 1) {
      if (suggestionsTimerRef.current) {
        clearTimeout(suggestionsTimerRef.current);
      }

      suggestionsTimerRef.current = setTimeout(() => {
        loadSuggestions(query);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (suggestionsTimerRef.current) {
        clearTimeout(suggestionsTimerRef.current);
      }
    };
  }, [query]);

  const loadInitialData = async () => {
    try {
      const popular = searchService.getPopularQueries(10);
      setPopularQueries(popular);

      // 模拟搜索历史
      setSearchHistory(['AI邮件分析', '过滤规则设置', '快捷键', '邮件分类']);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  const loadSuggestions = async (searchQuery: string) => {
    try {
      const autocompleteSuggestions = await searchService.getAutocompleteSuggestions(searchQuery, 8);
      setSuggestions(autocompleteSuggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const queryToSearch = searchQuery || query;
    if (!queryToSearch.trim()) return;

    setLoading(true);
    try {
      const searchParams: SearchQuery = {
        ...searchFilters,
        query: queryToSearch.trim()
      };

      const response = await searchService.search(searchParams);
      setSearchResponse(response);

      // 添加到搜索历史
      setSearchHistory(prev => {
        const newHistory = [queryToSearch, ...prev.filter(h => h !== queryToSearch)];
        return newHistory.slice(0, 10);
      });

      // 记录搜索分析
      searchService.trackSearchAnalytics({
        query: queryToSearch,
        userId: 'current_user',
        resultsCount: response.total,
        clickedResults: [],
        searchTime: response.took,
        refinements: [],
        abandoned: false
      });
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
      setShowSuggestions(false);
    }
  }, [query, searchFilters]);

  const handleSemanticSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const semanticResults = await searchService.semanticSearch(query, 10);
      setSearchResponse({
        results: semanticResults,
        total: semanticResults.length,
        took: 0,
        query: { query, semantic: true },
        suggestions: [],
        facets: {}
      });
    } catch (error) {
      console.error('Semantic search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    } else if (event.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: AutocompleteSuggestion) => {
    if (suggestion.type === 'shortcut' && suggestion.metadata?.id) {
      // 直接显示结果详情
      const result = searchResponse?.results.find(r => r.item.id === suggestion.metadata.id);
      if (result) {
        setSelectedResult(result);
        setResultDialogOpen(true);
      }
    } else {
      setQuery(suggestion.text);
      handleSearch(suggestion.text);
    }
  };

  const highlightText = (text: string, highlights: SearchResult['highlights']) => {
    if (!highlights.length) return text;

    let result = text;
    let offset = 0;

    highlights.forEach(highlight => {
      highlight.matches.forEach(match => {
        const start = match.start + offset;
        const end = match.end + offset;
        const highlightedText = `<mark style="background-color: ${alpha(theme.palette.primary.main, 0.3)}; padding: 1px 2px; border-radius: 2px;">${match.text}</mark>`;
        result = result.substring(0, start) + highlightedText + result.substring(end);
        offset += highlightedText.length - match.text.length;
      });
    });

    return result;
  };

  const renderSearchInterface = () => (
    <Box>
      {/* 搜索框 */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box position="relative">
          <TextField
            ref={searchInputRef}
            fullWidth
            placeholder="搜索邮件、联系人、帮助文档..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={() => query.length > 1 && setShowSuggestions(true)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Box display="flex" gap={1}>
                    <IconButton
                      size="small"
                      onClick={() => setFilterMenuAnchor(searchInputRef.current)}
                      color={searchFilters.type?.length ? 'primary' : 'default'}
                    >
                      <FilterIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setSortMenuAnchor(searchInputRef.current)}
                    >
                      <SortIcon />
                    </IconButton>
                    {query && (
                      <IconButton
                        size="small"
                        onClick={() => {
                          setQuery('');
                          setSearchResponse(null);
                        }}
                      >
                        <ClearIcon />
                      </IconButton>
                    )}
                  </Box>
                </InputAdornment>
              )
            }}
          />

          {/* 搜索建议下拉 */}
          {showSuggestions && suggestions.length > 0 && (
            <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
              <Paper
                elevation={8}
                sx={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 1000,
                  mt: 1,
                  maxHeight: 300,
                  overflow: 'auto'
                }}
              >
                <List dense>
                  {suggestions.map((suggestion, index) => (
                    <ListItem
                      key={index}
                      button
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <ListItemIcon>
                        {suggestion.type === 'shortcut' ? <StarIcon fontSize="small" /> : <SearchIcon fontSize="small" />}
                      </ListItemIcon>
                      <ListItemText
                        primary={suggestion.text}
                        secondary={suggestion.metadata?.source}
                      />
                      <Chip
                        label={suggestion.type}
                        size="small"
                        variant="outlined"
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </ClickAwayListener>
          )}
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
          <Box display="flex" gap={1}>
            <Button
              variant="contained"
              onClick={() => handleSearch()}
              disabled={!query.trim() || loading}
              startIcon={loading ? <CircularProgress size={16} /> : <SearchIcon />}
            >
              搜索
            </Button>
            <Button
              variant="outlined"
              onClick={handleSemanticSearch}
              disabled={!query.trim() || loading}
              startIcon={<AIIcon />}
            >
              语义搜索
            </Button>
          </Box>

          {searchResponse && (
            <Typography variant="caption" color="text.secondary">
              找到 {searchResponse.total} 个结果，耗时 {searchResponse.took}ms
            </Typography>
          )}
        </Box>
      </Paper>

      {/* 搜索历史和热门查询 */}
      {!searchResponse && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  搜索历史
                </Typography>
                <List dense>
                  {searchHistory.map((historyQuery, index) => (
                    <ListItem
                      key={index}
                      button
                      onClick={() => {
                        setQuery(historyQuery);
                        handleSearch(historyQuery);
                      }}
                    >
                      <ListItemIcon>
                        <TimeIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={historyQuery} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <TrendingIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  热门搜索
                </Typography>
                <List dense>
                  {popularQueries.map((popular, index) => (
                    <ListItem
                      key={index}
                      button
                      onClick={() => {
                        setQuery(popular.query);
                        handleSearch(popular.query);
                      }}
                    >
                      <ListItemText
                        primary={popular.query}
                        secondary={`${popular.count} 次搜索`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* 搜索结果 */}
      {searchResponse && (
        <Box>
          {searchResponse.suggestions && searchResponse.suggestions.length > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                您是否要搜索：
                {searchResponse.suggestions.map((suggestion, index) => (
                  <Button
                    key={index}
                    size="small"
                    onClick={() => {
                      setQuery(suggestion);
                      handleSearch(suggestion);
                    }}
                    sx={{ ml: 1 }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </Typography>
            </Alert>
          )}

          <List>
            {searchResponse.results.map((result, index) => (
              <Paper key={index} elevation={1} sx={{ mb: 2 }}>
                <ListItem
                  button
                  onClick={() => {
                    setSelectedResult(result);
                    setResultDialogOpen(true);
                  }}
                  sx={{ p: 2 }}
                >
                  <ListItemIcon>
                    {getIconByType(result.item.type)}
                  </ListItemIcon>
                  <Box flex={1}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Typography
                        variant="h6"
                        component="div"
                        dangerouslySetInnerHTML={{
                          __html: highlightText(
                            result.item.title,
                            result.highlights.filter(h => h.field === 'title')
                          )
                        }}
                      />
                      <Chip
                        label={result.item.type}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      dangerouslySetInnerHTML={{
                        __html: highlightText(
                          result.item.content.substring(0, 200) + (result.item.content.length > 200 ? '...' : ''),
                          result.highlights.filter(h => h.field === 'content')
                        )
                      }}
                      sx={{ mb: 1 }}
                    />

                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box display="flex" gap={0.5}>
                        {result.item.tags.slice(0, 3).map((tag) => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))}
                      </Box>

                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="caption" color="text.secondary">
                          相关度: {Math.round(result.score * 10) / 10}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {result.item.lastUpdated.toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </ListItem>
              </Paper>
            ))}
          </List>

          {searchResponse.results.length === 0 && (
            <Box textAlign="center" py={4}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                没有找到相关结果
              </Typography>
              <Typography variant="body2" color="text.secondary">
                尝试使用不同的关键词或检查拼写
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* 过滤菜单 */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setSearchFilters(prev => ({ ...prev, type: undefined }));
            setFilterMenuAnchor(null);
          }}
        >
          全部类型
        </MenuItem>
        {['email', 'contact', 'document', 'help', 'feature'].map((type) => (
          <MenuItem
            key={type}
            onClick={() => {
              setSearchFilters(prev => ({ ...prev, type: [type as any] }));
              setFilterMenuAnchor(null);
            }}
          >
            {getIconByType(type)}
            <Box ml={1}>
              {type === 'email' ? '邮件' :
               type === 'contact' ? '联系人' :
               type === 'document' ? '文档' :
               type === 'help' ? '帮助' : '功能'}
            </Box>
          </MenuItem>
        ))}
      </Menu>

      {/* 排序菜单 */}
      <Menu
        anchorEl={sortMenuAnchor}
        open={Boolean(sortMenuAnchor)}
        onClose={() => setSortMenuAnchor(null)}
      >
        {[
          { key: 'relevance', label: '相关度' },
          { key: 'date', label: '日期' },
          { key: 'importance', label: '重要性' },
          { key: 'alphabetical', label: '字母顺序' }
        ].map((option) => (
          <MenuItem
            key={option.key}
            onClick={() => {
              setSearchFilters(prev => ({ ...prev, sortBy: option.key as any }));
              setSortMenuAnchor(null);
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );

  const renderHelpCenter = () => (
    <Box>
      <Typography variant="h5" gutterBottom>
        帮助中心
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        快速找到您需要的帮助和支持信息
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                快速开始
              </Typography>
              <List dense>
                <ListItem button>
                  <ListItemText primary="新用户指南" secondary="了解基本功能" />
                </ListItem>
                <ListItem button>
                  <ListItemText primary="账户设置" secondary="配置您的偏好" />
                </ListItem>
                <ListItem button>
                  <ListItemText primary="连接邮箱" secondary="添加邮件账户" />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                功能指南
              </Typography>
              <List dense>
                <ListItem button>
                  <ListItemText primary="AI邮件分析" secondary="智能邮件处理" />
                </ListItem>
                <ListItem button>
                  <ListItemText primary="过滤规则" secondary="自动分类邮件" />
                </ListItem>
                <ListItem button>
                  <ListItemText primary="工作流集成" secondary="连接外部工具" />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                故障排除
              </Typography>
              <List dense>
                <ListItem button>
                  <ListItemText primary="常见问题" secondary="FAQ解答" />
                </ListItem>
                <ListItem button>
                  <ListItemText primary="错误代码" secondary="错误解决方案" />
                </ListItem>
                <ListItem button>
                  <ListItemText primary="联系支持" secondary="获取技术帮助" />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="智能搜索" icon={<SearchIcon />} />
          <Tab label="帮助中心" icon={<HelpIcon />} />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        {renderSearchInterface()}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {renderHelpCenter()}
      </TabPanel>

      {/* 搜索结果详情对话框 */}
      <Dialog
        open={resultDialogOpen}
        onClose={() => setResultDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedResult && (
          <>
            <DialogTitle>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box display="flex" alignItems="center" gap={1}>
                  {getIconByType(selectedResult.item.type)}
                  <Typography variant="h6">
                    {selectedResult.item.title}
                  </Typography>
                </Box>
                <Chip
                  label={selectedResult.item.type}
                  color="primary"
                  variant="outlined"
                />
              </Box>
            </DialogTitle>
            <DialogContent>
              <Typography variant="body1" paragraph>
                {selectedResult.item.content}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Box display="flex" gap={0.5} mb={2}>
                {selectedResult.item.tags.map((tag) => (
                  <Chip key={tag} label={tag} size="small" />
                ))}
              </Box>

              <Typography variant="caption" color="text.secondary">
                最后更新: {selectedResult.item.lastUpdated.toLocaleString()}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setResultDialogOpen(false)}>关闭</Button>
              <Button variant="contained" startIcon={<BookmarkIcon />}>
                收藏
              </Button>
              <Button startIcon={<ShareIcon />}>分享</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default SearchAndHelp;