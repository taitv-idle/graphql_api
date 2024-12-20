import React, {Component, Fragment} from 'react';
// import openSocket from 'socket.io-client';

import Post from '../../components/Feed/Post/Post';
import Button from '../../components/Button/Button';
import FeedEdit from '../../components/Feed/FeedEdit/FeedEdit';
import Input from '../../components/Form/Input/Input';
import Paginator from '../../components/Paginator/Paginator';
import Loader from '../../components/Loader/Loader';
import ErrorHandler from '../../components/ErrorHandler/ErrorHandler';
import './Feed.css';

class Feed extends Component {
  state = {
    isEditing: false,
    posts: [],
    totalPosts: 0,
    editPost: null,
    status: '',
    postPage: 1,
    postsLoading: true,
    editLoading: false
  };

  componentDidMount() {
    const graphqlQuery = {
      query: `{
      user {
        status
      }
    }`
    };

    fetch('http://localhost:8080/graphql', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this.props.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphqlQuery)
    })
        .then(res => {
          return res.json();
        })
        .then(resData => {
          if (resData.errors) {
            throw new Error('Fetching status failed!');
          }
          this.setState({status: resData.data.user.status});
        })
        .catch(this.catchError);

    this.loadPosts();

  }

  loadPosts = direction => {
    if (direction) {
      this.setState({postsLoading: true, posts: []});
    }
    let page = this.state.postPage;
    if (direction === 'next') {
      page++;
      this.setState({postPage: page});
    }
    if (direction === 'previous') {
      page--;
      this.setState({postPage: page});
    }

    const graphqlQuery = {
      query: `
        query FetchPosts($page: Int) {
          posts(page: $page) {
            posts {
              _id
              title
              content
              imageUrl
              creator {
                name
              }
              createdAt
            }
            totalPost
          }
        }
  `, variables: {
        page: page
      }
    };

    fetch('http://localhost:8080/graphql', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this.props.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })
        .then(res => {
          return res.json();
        })
        .then(resData => {
          if (resData.errors) {
            throw new Error('Fetching posts failed!');
          }
          this.setState({
            posts: resData.data.posts.posts.map(post => {
              return {
                ...post,
                imagePath: post.imageUrl
              }
            }),
            totalPosts: resData.data.posts.totalPost,
            postsLoading: false
          });
        })
        .catch(this.catchError);
  };

  statusUpdateHandler = event => {
    event.preventDefault();
    const graphqlQuery = {
      query: `
        mutation UpdateStatus($userStatus: String!) {
          updateStatus(status: $userStatus) {
            status
          }
        }
      `,
      variables: {
        userStatus: this.state.status
      }
    }
    fetch('http://localhost:8080/graphql', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this.props.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })
        .then(res => {
          return res.json();
        })
        .then(resData => {
          if (resData.errors) {
            throw new Error('updated status failed!');
          }
          console.log(resData);
        })
        .catch(this.catchError);
  };

  newPostHandler = () => {
    this.setState({isEditing: true});
  };

  startEditPostHandler = postId => {
    this.setState(prevState => {
      const loadedPost = {...prevState.posts.find(p => p._id === postId)};

      return {
        isEditing: true,
        editPost: loadedPost
      };
    });
  };

  cancelEditHandler = () => {
    this.setState({isEditing: false, editPost: null});
  };

  finishEditHandler = postData => {
    this.setState({ editLoading: true }); // Bật trạng thái tải dữ liệu (loading)

    // Chuẩn bị FormData để tải lên hình ảnh
    const formData = new FormData();
    formData.append('image', postData.image); // Gắn ảnh mới vào formData
    if (this.state.editPost) {
      formData.append('oldPath', this.state.editPost.imagePath); // Nếu đang chỉnh sửa, gửi kèm đường dẫn ảnh cũ
    }

    // Gửi yêu cầu PUT để tải ảnh lên server
    fetch('http://localhost:8080/post-image', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + this.props.token // Gửi token để xác thực
      },
      body: formData
    })
        .then(res => res.json()) // Chuyển đổi phản hồi thành JSON
        .then(fileResData => {
          const imageUrl = fileResData.filePath || 'undefined'; // Lấy đường dẫn ảnh từ phản hồi

          let graphqlQuery = {
            query: `
                mutation CreatePost($postTitle: String!, $postContent: String!, $postImageUrl: String!) {
                    createPost(postInput: {
                        title: $postTitle,
                        content: $postContent,
                        imageUrl: $postImageUrl
                    }) {
                        _id
                        title
                        content
                        imageUrl
                        creator {
                            name
                        }
                        createdAt
                    }
                }
            `,
            variables: {
              postTitle: postData.title,
              postContent: postData.content,
              postImageUrl: imageUrl
            }
          };

          if (this.state.editPost) {
            graphqlQuery = {
              query: `
                    mutation UpdatePost($postId: ID!, $postTitle: String!, $postContent: String!, $postImageUrl: String!) {
                        updatePost(id: $postId, postInput: {
                            title: $postTitle,
                            content: $postContent,
                            imageUrl: $postImageUrl
                        }) {
                            _id
                            title
                            content
                            imageUrl
                            creator {
                                name
                            }
                            createdAt
                        }
                    }
                `,
              variables: {
                postId: this.state.editPost._id,
                postTitle: postData.title,
                postContent: postData.content,
                postImageUrl: imageUrl
              }
            };
          }

          // Gửi yêu cầu GraphQL tới server
          return fetch('http://localhost:8080/graphql', {
            method: 'POST',
            body: JSON.stringify(graphqlQuery), // Gửi dữ liệu mutation
            headers: {
              Authorization: 'Bearer ' + this.props.token, // Xác thực người dùng
              'Content-Type': 'application/json'
            }
          });
        })
        .then(res => res.json()) // Chuyển đổi phản hồi GraphQL thành JSON
        .then(resData => {
          // Kiểm tra và xử lý lỗi từ server
          if (resData.errors && resData.errors[0].status === 422) {
            throw new Error(
                "Validation failed. Make sure the email address isn't used yet!"
            );
          }
          if (resData.errors) {
            throw new Error('Post creation failed!'); // Lỗi nếu server trả về lỗi khác
          }

          let resDataField = 'createPost'; // Mặc định là mutation `createPost`
          if (this.state.editPost) {
            resDataField = 'updatePost'; // Nếu chỉnh sửa, sử dụng mutation `updatePost`
          }

          // Tạo bài viết từ dữ liệu phản hồi
          const post = {
            _id: resData.data[resDataField]._id,
            title: resData.data[resDataField].title,
            content: resData.data[resDataField].content,
            creator: resData.data[resDataField].creator,
            createdAt: resData.data[resDataField].createdAt,
            imagePath: resData.data[resDataField].imageUrl
          };

          // Cập nhật danh sách bài viết trong `state`
          this.setState(prevState => {
            let updatedPosts = [...prevState.posts];
            let updatedTotalPosts = prevState.totalPosts;
            if (prevState.editPost) {
              const postIndex = prevState.posts.findIndex(
                  p => p._id === prevState.editPost._id
              );
              updatedPosts[postIndex] = post;
            } else {
              if (prevState.posts.length >= 2) {
                updatedTotalPosts++;
                updatedPosts.pop();
              }
              updatedPosts.unshift(post);
            }
            return {
              posts: updatedPosts,
              isEditing: false,
              editPost: null,
              editLoading: false,
              totalPosts: updatedTotalPosts
            };
          });
        })
        .catch(err => {
          // Xử lý lỗi và cập nhật state
          console.error(err);
          this.setState({
            isEditing: false,
            editPost: null,
            editLoading: false,
            error: err.message || 'Something went wrong!' // Hiển thị lỗi
          });
        });
  };


  statusInputChangeHandler = (input, value) => {
    this.setState({status: value});
  };

  deletePostHandler = postId => {
    this.setState({ postsLoading: true });
    const graphqlQuery = {
      query: `
            mutation {
                deletePost(id: "${postId}")
            }
       `
    };

    fetch('http://localhost:8080/graphql', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this.props.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })
        .then(res => res.json())
        .then(resData => {
          if (resData.errors) {
            throw new Error('Post delete failed!');
          }
          console.log(resData);
          this.loadPosts();
        })
        .catch(err => {
          console.log(err);
          this.setState({ postsLoading: false });
        });
  };

  errorHandler = () => {
    this.setState({error: null});
  };

  catchError = error => {
    this.setState({error: error});
  };

  render() {
    return (
        <Fragment>
          <ErrorHandler error={this.state.error} onHandle={this.errorHandler}/>
          <FeedEdit
              editing={this.state.isEditing}
              selectedPost={this.state.editPost}
              loading={this.state.editLoading}
              onCancelEdit={this.cancelEditHandler}
              onFinishEdit={this.finishEditHandler}
          />
          <section className="feed__status">
            <form onSubmit={this.statusUpdateHandler}>
              <Input
                  type="text"
                  placeholder="Your status"
                  control="input"
                  onChange={this.statusInputChangeHandler}
                  value={this.state.status}
              />
              <Button mode="flat" type="submit">
                Update
              </Button>
            </form>
          </section>
          <section className="feed__control">
            <Button mode="raised" design="accent" onClick={this.newPostHandler}>
              New Post
            </Button>
          </section>
          <section className="feed">
            {this.state.postsLoading && (
                <div style={{textAlign: 'center', marginTop: '2rem'}}>
                  <Loader/>
                </div>
            )}
            {this.state.posts.length <= 0 && !this.state.postsLoading ? (
                <p style={{textAlign: 'center'}}>No posts found.</p>
            ) : null}
            {!this.state.postsLoading && (
                <Paginator
                    onPrevious={this.loadPosts.bind(this, 'previous')}
                    onNext={this.loadPosts.bind(this, 'next')}
                    lastPage={Math.ceil(this.state.totalPosts / 2)}
                    currentPage={this.state.postPage}
                >
                  {this.state.posts.map(post => (
                      <Post
                          key={post._id}
                          id={post._id}
                          author={post.creator.name}
                          date={new Date(post.createdAt).toLocaleDateString('en-US')}
                          title={post.title}
                          image={post.imageUrl}
                          content={post.content}
                          onStartEdit={this.startEditPostHandler.bind(this, post._id)}
                          onDelete={this.deletePostHandler.bind(this, post._id)}
                      />
                  ))}
                </Paginator>
            )}
          </section>
        </Fragment>
    );
  }
}

export default Feed;
